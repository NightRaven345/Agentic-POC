package com.gov.portal.repository;

import com.gov.portal.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    Optional<User> findByPan(String pan);

    Optional<User> findByPhone(String phone);

    Optional<User> findByRegistrationId(String registrationId);

    List<User> findByStatus(String status);

    List<User> findByRole(String role);

    @Query("SELECT u FROM User u WHERE u.status = 'APPROVED' AND u.role = 'ROLE_USER'")
    List<User> findAllApprovedCitizens();

    @Query("SELECT u FROM User u WHERE u.status = 'PENDING' AND u.role = 'ROLE_USER'")
    List<User> findAllPendingCitizens();

    @Query("SELECT u FROM User u WHERE u.role = 'ROLE_USER'")
    List<User> findAllCitizens();

    @Query("SELECT u FROM User u WHERE u.status = 'APPROVED' AND u.role = 'ROLE_USER'")
    List<User> findAllApprovedUsers();

    @Query("SELECT u FROM User u WHERE u.role = 'ROLE_USER' AND (" +
           "LOWER(u.firstName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.lastName) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "LOWER(u.email) LIKE LOWER(CONCAT('%', :query, '%')) OR " +
           "u.pan = :query OR u.phone = :query OR " +
           "u.registrationId = :query)")
    List<User> searchUsers(@Param("query") String query);
}
