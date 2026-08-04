package com.gov.portal.repository;

import com.gov.portal.entity.Grievance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GrievanceRepository extends JpaRepository<Grievance, Long> {
    List<Grievance> findByCitizenUsernameOrderBySubmittedAtDesc(String username);
    List<Grievance> findByStatusOrderBySubmittedAtDesc(String status);
    List<Grievance> findByOrderBySubmittedAtDesc();
}
