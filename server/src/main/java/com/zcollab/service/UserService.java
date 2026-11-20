package com.zcollab.service;

import com.zcollab.dto.common.PageRequest;
import com.zcollab.vo.user.CurrentUserResponse;

public interface UserService {

    CurrentUserResponse me(PageRequest request);
}
