package com.zcollab.service.impl;

import cn.dev33.satoken.context.mock.SaTokenContextMockUtil;
import cn.dev33.satoken.stp.StpUtil;
import com.zcollab.entity.User;
import com.zcollab.entity.Workspace;
import com.zcollab.entity.WorkspaceInvite;
import com.zcollab.entity.WorkspaceMember;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.UserMapper;
import com.zcollab.mapper.WorkspaceInviteMapper;
import com.zcollab.mapper.WorkspaceMapper;
import com.zcollab.mapper.WorkspaceMemberMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.workspace.InviteResponse;
import com.zcollab.vo.workspace.MemberRow;
import com.zcollab.vo.workspace.PublicInviteResponse;
import com.zcollab.vo.workspace.WorkspaceMembership;
import com.zcollab.vo.workspace.WorkspaceSummaryResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DuplicateKeyException;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Proxy;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WorkspaceInviteServiceImplTest {

    private static final long USER_ID = 42L;
    private static final long OTHER_ID = 43L;
    private static final long WORKSPACE_ID = 7L;
    private static final long INVITE_ID = 100L;
    private static final String TOKEN = "0123456789abcdefghij";

    @BeforeEach
    void setUp() {
        SaTokenContextMockUtil.setMockContext();
    }

    @AfterEach
    void tearDown() {
        SaTokenContextMockUtil.clearContext();
    }

    @Test
    void memberCanCreateInviteAndSevenDaysIsDefault() {
        StpUtil.login(USER_ID);
        Fixture f = new Fixture();
        f.role = "member";

        InviteResponse result = service(f).create(null);

        assertEquals(1, f.inviteInserts.size());
        WorkspaceInvite created = f.inviteInserts.get(0);
        assertEquals(WORKSPACE_ID, created.getWorkspaceId());
        assertEquals(USER_ID, created.getCreatedBy());
        assertTrue(created.getToken().matches("[0-9A-Za-z]{22}"), created.getToken());
        assertTrue(Math.abs(Duration.between(OffsetDateTime.now().plusDays(7), created.getExpiresAt()).toSeconds()) < 5);
        assertEquals("/invite/" + created.getToken(), result.path());
        assertEquals("邀请人", result.creatorName());
    }

    @Test
    void zeroDaysNeverExpiresAndOtherValuesAreDays() {
        StpUtil.login(USER_ID);
        Fixture never = new Fixture();
        assertNull(service(never).create(0).expiresAt());

        Fixture thirty = new Fixture();
        OffsetDateTime expiresAt = service(thirty).create(30).expiresAt();
        assertTrue(Math.abs(Duration.between(OffsetDateTime.now().plusDays(30), expiresAt).toSeconds()) < 5);
    }

    @Test
    void createRetriesTokenCollisionOnlyOnce() {
        StpUtil.login(USER_ID);
        Fixture f = new Fixture();
        f.failFirstInsert = true;

        InviteResponse result = service(f).create(7);

        assertEquals(2, f.inviteInserts.size());
        assertTrue(!f.insertedTokens.get(0).equals(f.insertedTokens.get(1)));
        assertEquals(f.insertedTokens.get(1), result.token());

        Fixture alwaysFails = new Fixture();
        alwaysFails.failFirstInsert = true;
        alwaysFails.failEveryInsert = true;
        assertThrows(DuplicateKeyException.class, () -> service(alwaysFails).create(7));
        assertEquals(2, alwaysFails.inviteInserts.size());
    }

    @Test
    void listBatchesCreatorNamesAndKeepsOnlyReturnedRows() {
        StpUtil.login(USER_ID);
        Fixture f = new Fixture();
        f.active.add(invite(USER_ID, TOKEN));
        f.active.add(invite(OTHER_ID, "another-token-abcdefg"));
        f.users.put(USER_ID, user(USER_ID, "邀请人"));
        f.users.put(OTHER_ID, user(OTHER_ID, "第二位"));

        List<InviteResponse> result = service(f).list();

        assertEquals(1, f.selectByIdsCalls);
        assertEquals(2, result.size());
        assertEquals("邀请人", result.get(0).creatorName());
        assertEquals("第二位", result.get(1).creatorName());
        assertEquals("another-token-abcdefg", result.get(1).token());
    }

    @Test
    void acceptJoinsAsMemberAndIsIdempotent() {
        StpUtil.login(USER_ID);
        Fixture f = new Fixture();
        f.invite = invite(USER_ID, TOKEN);
        WorkspaceInviteServiceImpl service = service(f);

        WorkspaceSummaryResponse first = service.accept(TOKEN);
        assertEquals(WORKSPACE_ID, first.id());
        assertEquals("测试工作区", first.name());
        assertEquals("member", first.role());
        assertEquals(1, f.memberInserts.size());
        assertEquals("member", f.memberInserts.get(0).getRole());
        assertEquals(0, f.requireCurrentMembershipCalls);

        f.memberExists = true;
        f.existingRole = "owner";
        WorkspaceSummaryResponse second = service.accept(TOKEN);
        assertEquals("owner", second.role());
        assertEquals(1, f.memberInserts.size());
        assertEquals(0, f.requireCurrentMembershipCalls);
    }

    @Test
    void acceptFallsBackToWinnerOnConcurrentMemberInsert() {
        StpUtil.login(USER_ID);
        Fixture f = new Fixture();
        f.invite = invite(USER_ID, TOKEN);
        f.failFirstMemberInsert = true;

        assertEquals("member", service(f).accept(TOKEN).role());
        assertEquals(1, f.memberInserts.size());
    }

    @Test
    void acceptRejectsMissingRevokedAndExpiredTokens() {
        StpUtil.login(USER_ID);
        Fixture f = new Fixture();
        WorkspaceInviteServiceImpl service = service(f);

        assertNotFound(() -> service.accept("unknown"));
        assertNotFound(() -> service.accept(" "));

        WorkspaceInvite revoked = invite(USER_ID, TOKEN);
        revoked.setRevokedAt(OffsetDateTime.now());
        f.invite = revoked;
        assertNotFound(() -> service.accept(TOKEN));

        WorkspaceInvite expired = invite(USER_ID, TOKEN);
        expired.setExpiresAt(OffsetDateTime.now().minusSeconds(1));
        f.invite = expired;
        assertNotFound(() -> service.accept(TOKEN));
        assertEquals(0, f.memberInserts.size());
    }

    @Test
    void previewNeedsNoLoginAndRejectsInvalidTokens() {
        Fixture f = new Fixture();
        f.invite = invite(USER_ID, TOKEN);
        f.memberCount = 5;
        WorkspaceInviteServiceImpl service = service(f);

        PublicInviteResponse preview = service.preview(TOKEN);
        assertEquals("测试工作区", preview.workspaceName());
        assertEquals("邀请人", preview.inviterName());
        assertEquals(5, preview.memberCount());
        assertNull(preview.expiresAt());

        OffsetDateTime expiresAt = OffsetDateTime.parse("2026-12-01T00:00:00Z");
        f.invite.setExpiresAt(expiresAt);
        assertEquals(expiresAt, service.preview(TOKEN).expiresAt());

        f.invite.setRevokedAt(OffsetDateTime.now());
        assertNotFound(() -> service.preview(TOKEN));
        f.invite = null;
        assertNotFound(() -> service.preview(TOKEN));
    }

    @Test
    void revokeRejectsNonCreatorNonOwner() {
        StpUtil.login(OTHER_ID);
        Fixture f = new Fixture();
        f.invite = invite(USER_ID, TOKEN);
        f.role = "member";

        BusinessException error = assertThrows(BusinessException.class, () -> service(f).revoke(INVITE_ID));
        assertSame(ErrorCode.FORBIDDEN, error.getErrorCode());
        assertEquals(0, f.revokeCalls);
    }

    @Test
    void revokeAllowsCreatorAndOwnerAndIsIdempotent() {
        StpUtil.login(USER_ID);
        Fixture creator = new Fixture();
        creator.invite = invite(USER_ID, TOKEN);
        creator.role = null;
        service(creator).revoke(INVITE_ID);
        assertEquals(1, creator.revokeCalls);

        StpUtil.login(OTHER_ID);
        Fixture owner = new Fixture();
        owner.invite = invite(USER_ID, TOKEN);
        owner.role = "owner";
        service(owner).revoke(INVITE_ID);
        assertEquals(1, owner.revokeCalls);

        StpUtil.login(USER_ID);
        Fixture alreadyRevoked = new Fixture();
        alreadyRevoked.invite = invite(USER_ID, TOKEN);
        alreadyRevoked.invite.setRevokedAt(OffsetDateTime.now());
        service(alreadyRevoked).revoke(INVITE_ID);
        assertEquals(0, alreadyRevoked.revokeCalls);
    }

    @Test
    void revokeMissingInviteIsNotFound() {
        StpUtil.login(USER_ID);
        Fixture f = new Fixture();
        assertNotFound(() -> service(f).revoke(INVITE_ID));
    }

    private static void assertNotFound(Runnable action) {
        BusinessException error = assertThrows(BusinessException.class, action::run);
        assertSame(ErrorCode.NOT_FOUND, error.getErrorCode());
    }

    private static WorkspaceInviteServiceImpl service(Fixture f) {
        WorkspaceInviteMapper invites = proxy(WorkspaceInviteMapper.class, (p, method, args) -> switch (method.getName()) {
            case "insert" -> {
                WorkspaceInvite invite = (WorkspaceInvite) args[0];
                f.inviteInserts.add(invite);
                f.insertedTokens.add(invite.getToken());
                if (f.failFirstInsert && (f.failEveryInsert || f.inviteInserts.size() == 1)) {
                    throw new DuplicateKeyException("duplicate token");
                }
                yield 1;
            }
            case "selectById" -> f.invite;
            case "selectByToken" -> f.invite;
            case "selectActiveByWorkspace" -> f.active;
            case "revokeById" -> {
                f.revokeCalls += 1;
                yield 1;
            }
            default -> throw new UnsupportedOperationException(method.getName());
        });

        WorkspaceMemberService members = proxy(WorkspaceMemberService.class, (p, method, args) -> switch (method.getName()) {
            case "requireCurrentMembership" -> {
                f.requireCurrentMembershipCalls += 1;
                yield new WorkspaceMembership(WORKSPACE_ID, f.role);
            }
            case "findMembership" -> f.role == null ? null : new WorkspaceMembership(WORKSPACE_ID, f.role);
            case "countByWorkspace" -> f.memberCount;
            default -> throw new UnsupportedOperationException(method.getName());
        });

        WorkspaceMemberMapper memberMapper = proxy(WorkspaceMemberMapper.class, (p, method, args) -> switch (method.getName()) {
            case "selectMemberRow" -> {
                if (!f.memberExists) yield null;
                MemberRow row = new MemberRow();
                row.setId(1L);
                row.setRole(f.existingRole);
                yield row;
            }
            case "insert" -> {
                f.memberInserts.add((WorkspaceMember) args[0]);
                if (f.failFirstMemberInsert && f.memberInserts.size() == 1) {
                    throw new DuplicateKeyException("duplicate member");
                }
                yield 1;
            }
            default -> throw new UnsupportedOperationException(method.getName());
        });

        WorkspaceMapper workspaces = proxy(WorkspaceMapper.class, (p, method, args) -> {
            if ("selectById".equals(method.getName())) return f.workspace;
            throw new UnsupportedOperationException(method.getName());
        });

        UserMapper users = proxy(UserMapper.class, (p, method, args) -> switch (method.getName()) {
            case "selectById" -> f.users.get(((Number) args[0]).longValue());
            case "selectByIds" -> {
                f.selectByIdsCalls += 1;
                @SuppressWarnings("unchecked")
                Collection<Long> ids = (Collection<Long>) args[0];
                yield ids.stream().map(f.users::get).filter(java.util.Objects::nonNull).toList();
            }
            default -> throw new UnsupportedOperationException(method.getName());
        });

        return new WorkspaceInviteServiceImpl(invites, members, memberMapper, workspaces, users);
    }

    private static WorkspaceInvite invite(long creatorId, String token) {
        WorkspaceInvite invite = new WorkspaceInvite();
        invite.setId(INVITE_ID);
        invite.setWorkspaceId(WORKSPACE_ID);
        invite.setToken(token);
        invite.setCreatedBy(creatorId);
        invite.setCreatedAt(OffsetDateTime.now());
        return invite;
    }

    private static User user(long id, String name) {
        User user = new User();
        user.setId(id);
        user.setName(name);
        return user;
    }

    private static final class Fixture {
        private String role = "member";
        private WorkspaceInvite invite;
        private final List<WorkspaceInvite> active = new ArrayList<>();
        private final List<WorkspaceInvite> inviteInserts = new ArrayList<>();
        private final List<String> insertedTokens = new ArrayList<>();
        private final List<WorkspaceMember> memberInserts = new ArrayList<>();
        private final Map<Long, User> users = new HashMap<>(Map.of(USER_ID, user(USER_ID, "邀请人")));
        private final Workspace workspace = workspace();
        private boolean failFirstInsert;
        private boolean failEveryInsert;
        private boolean failFirstMemberInsert;
        private boolean memberExists;
        private String existingRole = "member";
        private int memberCount = 3;
        private int revokeCalls;
        private int requireCurrentMembershipCalls;
        private int selectByIdsCalls;
    }

    private static Workspace workspace() {
        Workspace workspace = new Workspace();
        workspace.setId(WORKSPACE_ID);
        workspace.setName("测试工作区");
        return workspace;
    }

    @SuppressWarnings("unchecked")
    private static <T> T proxy(Class<T> type, InvocationHandler handler) {
        return (T) Proxy.newProxyInstance(type.getClassLoader(), new Class<?>[]{type}, handler);
    }
}
