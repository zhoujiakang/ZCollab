package com.zcollab.service.impl;

import com.baomidou.mybatisplus.core.MybatisConfiguration;
import com.baomidou.mybatisplus.extension.spring.MybatisSqlSessionFactoryBean;
import com.zcollab.exception.BusinessException;
import com.zcollab.exception.ErrorCode;
import com.zcollab.mapper.DocMapper;
import com.zcollab.service.WorkspaceMemberService;
import com.zcollab.vo.workspace.WorkspaceMembership;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.mybatis.spring.SqlSessionTemplate;
import org.postgresql.ds.PGSimpleDataSource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** Opt-in PostgreSQL integration test. Every run uses and removes its own isolated schema. */
@EnabledIfEnvironmentVariable(named = "ZCOLLAB_TEST_JDBC_URL", matches = ".+")
class DocTreeConcurrencyTest {
    PGSimpleDataSource dataSource;
    JdbcTemplate jdbc;
    String schema;

    @BeforeEach
    void setup() {
        dataSource = new PGSimpleDataSource();
        dataSource.setUrl(System.getenv("ZCOLLAB_TEST_JDBC_URL"));
        dataSource.setUser(System.getenv().getOrDefault("ZCOLLAB_TEST_DB_USER", System.getProperty("user.name")));
        dataSource.setSocketTimeout(15);
        schema = "tree_test_" + UUID.randomUUID().toString().replace("-", "");
        new JdbcTemplate(dataSource).execute("CREATE SCHEMA " + schema);
        dataSource.setCurrentSchema(schema);
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("CREATE TABLE workspace (id bigint PRIMARY KEY)");
        jdbc.execute("""
            CREATE TABLE doc (
                id bigint PRIMARY KEY, workspace_id bigint NOT NULL, parent_doc_id bigint,
                title text DEFAULT '', content text DEFAULT '', content_text text DEFAULT '',
                sort_order integer DEFAULT 0, created_at timestamptz DEFAULT now(),
                updated_at timestamptz DEFAULT now(), deleted_at timestamptz
            )
            """);
        jdbc.update("INSERT INTO workspace VALUES (7)");
        jdbc.update("INSERT INTO doc (id,workspace_id) VALUES (1,7),(2,7)");
    }

    @AfterEach
    void cleanup() {
        if (jdbc != null) jdbc.execute("DROP SCHEMA " + schema + " CASCADE");
    }

    @Test
    void oppositeConcurrentMovesCannotCreateCycle() throws Exception {
        MybatisConfiguration config = new MybatisConfiguration();
        config.setMapUnderscoreToCamelCase(true);
        config.addMapper(DocMapper.class);
        MybatisSqlSessionFactoryBean factory = new MybatisSqlSessionFactoryBean();
        factory.setDataSource(dataSource);
        factory.setConfiguration(config);
        DocMapper real = new SqlSessionTemplate(factory.getObject()).getMapper(DocMapper.class);
        CountDownLatch firstLocked = new CountDownLatch(1);
        CountDownLatch secondAttempted = new CountDownLatch(1);
        DocMapper guarded = (DocMapper) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[]{DocMapper.class}, (proxy, method, args) -> {
                    boolean lock = method.getName().equals("lockWorkspaceTree");
                    boolean first = Thread.currentThread().getName().equals("first-move");
                    if (lock && !first) secondAttempted.countDown();
                    Object result;
                    try { result = method.invoke(real, args); }
                    catch (InvocationTargetException e) { throw e.getCause(); }
                    if (lock && first) {
                        firstLocked.countDown();
                        assertTrue(secondAttempted.await(5, TimeUnit.SECONDS));
                    }
                    return result;
                });
        WorkspaceMemberService members = (WorkspaceMemberService) Proxy.newProxyInstance(
                getClass().getClassLoader(), new Class<?>[]{WorkspaceMemberService.class},
                (proxy, method, args) -> new WorkspaceMembership(7L, "member"));
        DocServiceImpl service = new DocServiceImpl(guarded, null, members, null, null);
        TransactionTemplate tx = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                Thread.currentThread().setName("first-move");
                tx.executeWithoutResult(status -> service.move(1L, 2L, null));
            });
            assertTrue(firstLocked.await(5, TimeUnit.SECONDS));
            var second = executor.submit(() -> {
                Thread.currentThread().setName("second-move");
                try {
                    tx.executeWithoutResult(status -> service.move(2L, 1L, null));
                    return null;
                } catch (BusinessException e) {
                    return e.getErrorCode();
                }
            });
            first.get(10, TimeUnit.SECONDS);
            assertEquals(ErrorCode.BAD_REQUEST, second.get(10, TimeUnit.SECONDS));
        }
        assertEquals(2L, jdbc.queryForObject("SELECT parent_doc_id FROM doc WHERE id=1", Long.class));
        assertNull(jdbc.queryForObject("SELECT parent_doc_id FROM doc WHERE id=2", Long.class));
    }
}
