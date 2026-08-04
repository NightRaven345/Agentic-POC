package com.gov.portal.repository;

import com.gov.portal.entity.Notice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface NoticeRepository extends JpaRepository<Notice, Long> {
    List<Notice> findByOrderByCreatedAtDesc();
    List<Notice> findByCategoryOrderByCreatedAtDesc(String category);
}
