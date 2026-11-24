package com.zcollab.store;

import com.zcollab.core.store.DocStore;
import com.zcollab.core.store.DocState;
import com.zcollab.entity.DocUpdate;
import com.zcollab.mapper.DocMapper;
import com.zcollab.mapper.DocUpdateMapper;
import com.zcollab.vo.doc.DocSnapshotRow;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;

/** PostgreSQL-backed DocStore. Outside core.store so core keeps depending on the JDK only. */
@Component
public class PgDocStore implements DocStore {

    private static final Logger log = LoggerFactory.getLogger(PgDocStore.class);

    private final DocUpdateMapper updateMapper;
    private final DocMapper docMapper;

    public PgDocStore(DocUpdateMapper updateMapper, DocMapper docMapper) {
        this.updateMapper = updateMapper;
        this.docMapper = docMapper;
    }

    @Override
    public byte[] readSnapshot(long docId) {
        DocSnapshotRow row = docMapper.selectSnapshot(docId);
        return row == null ? null : row.getSnapshot();
    }

    @Override
    public List<byte[]> readUpdates(long docId) {
        DocSnapshotRow row = docMapper.selectSnapshot(docId);
        long snapshotSeq = row == null ? 0 : (row.getSnapshotSeq() == null ? 0 : row.getSnapshotSeq());
        return updateMapper.selectByDocIdOrderBySeq(docId, snapshotSeq).stream()
                .map(DocUpdate::getPayload)
                .toList();
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void appendUpdate(long docId, byte[] update) {
        Objects.requireNonNull(update, "update");
        docMapper.lockDocument(docId);
        long seq = updateMapper.selectNextSeq(docId);
        DocUpdate row = new DocUpdate();
        row.setDocId(docId);
        row.setSeq(seq);
        row.setPayload(update);
        updateMapper.insert(row);
        log.info("文档 {} 追加 update，seq={}，字节数={}", docId, seq, update.length);
    }

    @Override
    @Transactional
    public DocState readState(long docId) {
        docMapper.lockDocument(docId);
        return DocStore.super.readState(docId);
    }

    @Override
    @Transactional
    public boolean saveSnapshot(long docId, byte[] snapshot, String expectedVersion) {
        Objects.requireNonNull(snapshot, "snapshot");
        // 与追加增量共用数据库行锁，版本检查到删除之间不能插入新编辑。
        docMapper.lockDocument(docId);
        if (!DocStore.super.readState(docId).version().equals(expectedVersion)) return false;
        long coveredSeq = updateMapper.selectNextSeq(docId) - 1;
        docMapper.updateSnapshot(docId, snapshot, coveredSeq);
        updateMapper.deleteByDocIdAndSeqLessThanEqual(docId, coveredSeq);
        log.info("文档 {} 保存快照，覆盖到 seq={}，字节数={}", docId, coveredSeq, snapshot.length);
        return true;
    }
}
