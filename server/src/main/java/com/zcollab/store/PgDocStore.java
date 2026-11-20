package com.zcollab.store;

import com.zcollab.core.store.DocStore;
import com.zcollab.entity.DocUpdate;
import com.zcollab.mapper.DocUpdateMapper;
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

    private final DocUpdateMapper mapper;

    public PgDocStore(DocUpdateMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public byte[] readSnapshot(long docId) {
        // 快照列下一步才加，当前没有可读的快照。
        return null;
    }

    @Override
    public List<byte[]> readUpdates(long docId) {
        return mapper.selectByDocIdOrderBySeq(docId).stream()
                .map(DocUpdate::getPayload)
                .toList();
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void appendUpdate(long docId, byte[] update) {
        Objects.requireNonNull(update, "update");
        long seq = mapper.selectNextSeq(docId);
        DocUpdate row = new DocUpdate();
        row.setDocId(docId);
        row.setSeq(seq);
        row.setPayload(update);
        mapper.insert(row);
        log.info("文档 {} 追加 update，seq={}，字节数={}", docId, seq, update.length);
    }

    @Override
    public void saveSnapshot(long docId, byte[] snapshot) {
        // 下一步接快照列，当前留空实现。
    }
}
