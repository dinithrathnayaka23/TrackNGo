
package com.trackngo.auth.internal.repository;

import com.trackngo.auth.internal.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> { //user means table
    Optional<User> findByEmail(String email);
    @Query(value = """
            SELECT u.*
            FROM `user` u
            LEFT JOIN passenger p ON p.passenger_id = u.user_id
            LEFT JOIN driver d ON d.driver_id = u.user_id
            LEFT JOIN admin a ON a.admin_id = u.user_id
            LEFT JOIN corporate_user c ON c.corporate_user_id = u.user_id
            WHERE LOWER(u.email) = LOWER(:identifier)
               OR p.mobile_number = :identifier
               OR d.phone_number = :identifier
               OR a.phone_number = :identifier
               OR c.contact_phone = :identifier
            LIMIT 1
            """, nativeQuery = true)
    Optional<User> findByIdentifier(@Param("identifier") String identifier);
    boolean existsByEmail(String email);
}

