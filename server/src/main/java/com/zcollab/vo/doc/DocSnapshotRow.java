package com.zcollab.vo.doc;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DocSnapshotRow {

    private byte[] snapshot;

    private Long snapshotSeq;
}
