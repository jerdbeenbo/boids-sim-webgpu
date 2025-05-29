const MAX_SPEED: f32 = 6.0;
const MAX_FORCE: f32 = 0.9; //How sharp or smooth they turn

const GRID_RESOLUTION: u32 = 40; //each cell is 40x40 pixels
const WIDTH: u32 = 1200;
const HEIGHT: u32 = 800;

const COLS: u32 = WIDTH / GRID_RESOLUTION;
const ROWS: u32 = HEIGHT / GRID_RESOLUTION;

struct Boid {
    position: vec2f,
    velocity: vec2f, //Velocity
    acceleration: vec2f,
    max_speed: f32, //Generation Speed
    max_force: f32, //Alignment / Cohesion / Separation
}

@group(0) @binding(0) var<storage, read_write> boids: array<Boid>;
@group(0) @binding(1) var<uniform> params: vec4f; // [deltaTime, width, height, numBoids]

fn clamp_length_max(v: vec2f, max_length: f32) -> vec2f {
    let len = length(v);
    if (len > max_length) {
        return normalize(v) * max_length;
    }
    return v;
}

fn seek(index: u32, target_pos: vec2f) -> vec2f {
    // Calculate desired velocity (target - current position)
    var desired = target_pos - boids[index].position;

    // Safe normalization check
    if length(desired) < 0.001 {
        return vec2f(0.0, 0.0);
    }

    // Set magnitude to max speed
    desired = normalize(desired) * MAX_SPEED;

    // Calculate steering force (desired - current velocity)
    var steer = desired - boids[index].velocity;

    // Limit steering force
    var steer_result = clamp_length_max(steer, MAX_FORCE);

    return steer_result;
}

fn separate(self_index: u32) -> vec2f {
    let desired_separation: f32 = 19.0;
    var sum = vec2f(0.0, 0.0);
    var count = 0u;

    for (var other = 0u; other < u32(params.w); other++) {
        let dist = distance(boids[self_index].position, boids[other].position);

        if self_index != other && dist > 0.001 && dist < desired_separation {
            // Added minimum distance check
            var diff = boids[self_index].position - boids[other].position;

            // Safe normalization
            if length(diff) > 0.001 {
                diff = normalize(diff) / dist;
                sum += diff;
                count += 1u;
            }
        }
    }

    if count > 0u {
        sum /= f32(count);

        // Safe normalization
        if length(sum) > 0.001 {
            sum = normalize(sum) * MAX_SPEED;
            let steer = sum - boids[self_index].velocity;
            var steer_result = clamp_length_max(steer, MAX_FORCE);
            return steer_result;
        } else {
            return vec2f(0.0, 0.0);
        }
    } else {
        return vec2f(0.0, 0.0);
    }
}

fn align(self_index: u32) -> vec2f {
    let desired_view_angle: f32 = 2.0;
    let neighbour_distance = 50.0;

    var sum = vec2f(0.0, 0.0);
    var count = 0u;

    for (var other = 0u; other < u32(params.w); other++) {
        let d1 = boids[self_index].velocity;
        let d2 = boids[other].position - boids[self_index].position;
        let angle = abs(acos(dot(normalize(d1), normalize(d2))));
        let dist = distance(boids[self_index].position, boids[other].position);

        if self_index != other && angle < desired_view_angle && dist < neighbour_distance {
            sum += boids[other].velocity;
            count += 1u;
        }
    }

    if count > 0u {
        sum /= f32(count);
        if length(sum) > 0.001 {
            sum = normalize(sum) * MAX_SPEED;
        } else {
            sum = vec2f(0.0, 0.0);
        }

        let steer = sum - boids[self_index].velocity;
        var steer_result = clamp_length_max(steer, MAX_FORCE);
        return steer_result;
    } else {
        return vec2f(0.0, 0.0);
    }
}

fn cohere(self_index: u32) -> vec2f {
    let neighbour_distance: f32 = 40.0;

    var sum = vec2f(0.0, 0.0);
    var count = 0u;
    
    for (var other = 0u; other < u32(params.w); other++) {
        let dist = distance(boids[self_index].position, boids[other].position);
        if self_index != other && dist < neighbour_distance {
            sum += boids[other].position;
            count += 1u;
        }
    }
    
    if count > 0u {
        sum /= f32(count);
        return seek(self_index, sum);
    } else {
        return vec2f(0.0, 0.0);
    }
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) id: vec3u) {
    let index = id.x;
    if (index >= u32(params.w)) { return; } // bounds check
    
    let delta_time = params.x;
    let time_scale = delta_time * 60.0; // Normalize to 60fps equivalent
    
    // Calculate all the forces
    let separation_force = separate(index);
    let alignment_force = align(index);
    let cohesion_force = cohere(index);
    
    // Apply your weight multipliers from Rust version
    let separation = separation_force * 1.5;
    let alignment = alignment_force * 1.0;
    let cohesion = cohesion_force * 1.2;
    
    // Combine all forces into total acceleration
    let total_acceleration = separation + alignment + cohesion;
    
    // Update velocity with acceleration
    var new_velocity = boids[index].velocity + total_acceleration * time_scale;
    new_velocity = clamp_length_max(new_velocity, MAX_SPEED);
    
    // Update position with velocity
    var new_position = boids[index].position + new_velocity * time_scale;
    
    // Screen wrapping from Rust version
    if (new_position.x < 0.0) { new_position.x = f32(WIDTH); }
    if (new_position.x > f32(WIDTH)) { new_position.x = 0.0; }
    if (new_position.y < 0.0) { new_position.y = f32(HEIGHT); }
    if (new_position.y > f32(HEIGHT)) { new_position.y = 0.0; }
    
    // Write back to the boids array
    boids[index].velocity = new_velocity;
    boids[index].position = new_position;
    boids[index].acceleration = vec2f(0.0, 0.0); // Reset acceleration
}