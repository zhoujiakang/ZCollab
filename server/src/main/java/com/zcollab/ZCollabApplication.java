package com.zcollab;

import org.springframework.boot.SpringApplication;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("com.zcollab.mapper")
public class ZCollabApplication {

    public static void main(String[] args) {
        SpringApplication.run(ZCollabApplication.class, args);
    }
}
