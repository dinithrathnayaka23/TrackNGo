package com.trackngo.booking.internal.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "seat_layout", uniqueConstraints = @UniqueConstraint(columnNames = {"bus_id", "seat_label"}))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class SeatLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "bus_id", nullable = false)
    private Long busId;

    @Column(name = "seat_label", nullable = false, length = 10)
    private String seatLabel;

    @Column(name = "row_num", nullable = false)
    private int rowNum;

    @Column(name = "position_group", nullable = false, length = 10)
    private String positionGroup; // 'left', 'right', 'back'

    @Column(name = "position_index", nullable = false)
    private int positionIndex;
}
