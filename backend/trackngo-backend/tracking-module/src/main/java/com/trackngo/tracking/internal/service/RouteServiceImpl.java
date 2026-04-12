
package com.trackngo.tracking.internal.service;

import com.trackngo.commons.exception.BusinessException;
import com.trackngo.commons.exception.ResourceNotFoundException;
import com.trackngo.tracking.api.RouteService;
import com.trackngo.tracking.api.dto.RouteDto;
import com.trackngo.tracking.internal.entity.Route;
import com.trackngo.tracking.internal.entity.RouteStop;
import com.trackngo.tracking.internal.entity.RouteStopId;
import com.trackngo.tracking.internal.repository.RouteRepository;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class RouteServiceImpl implements RouteService {
    private final RouteRepository repository;
    private final EntityManager entityManager;

    @Override
    @Transactional
    public RouteDto create(RouteDto dto) {
        if (dto.getCode() != null && repository.existsByRouteCode(dto.getCode())) {
            throw new BusinessException("Route code already exists: " + dto.getCode());
        }

        Route entity = new Route();
        applyDtoToEntity(dto, entity);
        return toDto(repository.save(entity));
    }

    @Override
    @Transactional(readOnly = true)
    public RouteDto get(Long id) {
        return toDto(repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Route not found")));
    }

    @Override
    @Transactional(readOnly = true)
    public List<RouteDto> getAll() {
        return repository.findAll().stream().map(this::toDto).toList();
    }

    @Override
    @Transactional
    public RouteDto update(Long id, RouteDto dto) {
        Route entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Route not found"));

        if (dto.getCode() != null && repository.existsByRouteCodeAndIdNot(dto.getCode(), id)) {
            throw new BusinessException("Route code already exists: " + dto.getCode());
        }

        applyDtoToEntity(dto, entity);
        return toDto(repository.save(entity));
    }

    @Override
    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new ResourceNotFoundException("Route not found");
        }
        repository.deleteById(id);
    }

    @Override
    @Transactional
    public RouteDto toggleStatus(Long id) {
        Route entity = repository.findById(id)
            .orElseThrow(() -> new ResourceNotFoundException("Route not found"));
        entity.setIsActive(!Boolean.TRUE.equals(entity.getIsActive()));
        return toDto(repository.save(entity));
    }

    private void applyDtoToEntity(RouteDto dto, Route entity) {
        entity.setRouteName(dto.getName());
        entity.setRouteCode(dto.getCode());
        entity.setRouteType(dto.getType());
        entity.setEstDistanceDifference(parseDistance(dto.getDistance()));
        entity.setEstimatedTimeDuration(parseDuration(dto.getDuration()));
        entity.setFee(parseFare(dto.getBaseFare()));
        entity.setActiveBuses(dto.getActiveBuses() != null ? dto.getActiveBuses() : 0);
        entity.setIsActive("Active".equalsIgnoreCase(dto.getStatus()));

        List<String> stopNames = dto.getStops();
        if (stopNames != null && !stopNames.isEmpty()) {
            entity.setStartLocation(stopNames.get(0));
            entity.setEndLocation(stopNames.get(stopNames.size() - 1));
        } else {
            entity.setStartLocation("");
            entity.setEndLocation("");
        }

        entity.getStops().clear();
        if (entity.getId() != null) {
            entityManager.flush();
        }
        if (stopNames != null) {
            for (int i = 0; i < stopNames.size(); i++) {
                RouteStop stop = new RouteStop();
                stop.setId(new RouteStopId(entity.getId(), i + 1));
                stop.setRoute(entity);
                stop.setName(stopNames.get(i));
                entity.getStops().add(stop);
            }
        }
    }

    private RouteDto toDto(Route entity) {
        RouteDto dto = new RouteDto();
        dto.setId(entity.getId());
        dto.setName(entity.getRouteName());
        dto.setCode(entity.getRouteCode() != null ? entity.getRouteCode() : "");
        dto.setType(entity.getRouteType() != null ? entity.getRouteType() : "");
        dto.setDistance(formatDistance(entity.getEstDistanceDifference()));
        dto.setDuration(formatDuration(entity.getEstimatedTimeDuration()));
        dto.setActiveBuses(entity.getActiveBuses() != null ? entity.getActiveBuses() : 0);
        dto.setBaseFare(formatFare(entity.getFee()));
        dto.setStatus(Boolean.TRUE.equals(entity.getIsActive()) ? "Active" : "Inactive");

        List<String> stopNames = new ArrayList<>();
        if (entity.getStops() != null) {
            for (RouteStop stop : entity.getStops()) {
                stopNames.add(stop.getName());
            }
        }
        dto.setStops(stopNames);

        return dto;
    }

    private BigDecimal parseDistance(String distance) {
        if (distance == null || distance.isBlank()) return BigDecimal.ZERO;
        Matcher m = Pattern.compile("([\\d.]+)").matcher(distance);
        return m.find() ? new BigDecimal(m.group(1)) : BigDecimal.ZERO;
    }

    private Integer parseDuration(String duration) {
        if (duration == null || duration.isBlank()) return 0;
        int total = 0;
        Matcher hm = Pattern.compile("(\\d+)h").matcher(duration);
        if (hm.find()) total += Integer.parseInt(hm.group(1)) * 60;
        Matcher mm = Pattern.compile("(\\d+)m").matcher(duration);
        if (mm.find()) total += Integer.parseInt(mm.group(1));
        return total;
    }

    private BigDecimal parseFare(String fare) {
        if (fare == null || fare.isBlank()) return BigDecimal.ZERO;
        String cleaned = fare.replaceAll("(?i)^rs\\.?", "").replaceAll("[^\\d.]", "");
        return cleaned.isEmpty() ? BigDecimal.ZERO : new BigDecimal(cleaned);
    }

    private String formatDistance(BigDecimal distance) {
        if (distance == null) return "0 km";
        return distance.stripTrailingZeros().toPlainString() + " km";
    }

    private String formatDuration(Integer minutes) {
        if (minutes == null || minutes == 0) return "0h 0m";
        int h = minutes / 60;
        int m = minutes % 60;
        return h + "h " + m + "m";
    }

    private String formatFare(BigDecimal fee) {
        if (fee == null) return "Rs.0";
        return "Rs." + fee.stripTrailingZeros().toPlainString();
    }
}

