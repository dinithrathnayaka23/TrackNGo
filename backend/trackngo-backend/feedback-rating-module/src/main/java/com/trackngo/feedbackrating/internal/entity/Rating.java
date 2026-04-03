package com.trackngo.feedbackrating.internal.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Data
@Table(name = "ratings")
public class Rating {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;
}
