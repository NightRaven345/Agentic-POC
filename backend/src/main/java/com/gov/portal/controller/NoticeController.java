package com.gov.portal.controller;

import com.gov.portal.entity.Notice;
import com.gov.portal.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/public")
public class NoticeController {

    @Autowired
    private UserService userService;

    /** Public endpoint — all visitors can see notices, no auth required. */
    @GetMapping("/notices")
    public ResponseEntity<List<Notice>> getAllNotices() {
        return ResponseEntity.ok(userService.getAllNotices());
    }
}
