use std::ops::Sub;

use glam::Vec2;
use wasm_bindgen::prelude::*;

const MAX_SPEED: f32 = 6.0;
const MAX_FORCE: f32 = 0.9; //How sharp or smooth they turn

///The "Boid" is the individual bird that when combined, creates a complex
/// flocking behaviour system
/// #### Params
/// ```
/// x: f32, y: f32 -> x,y positions along the 2D plane
/// vx: f32, vy: f32 -> directional x,y velocity
/// max_speed: f32 -> maximum speed the boid can go
/// max_force: f32 -> force applied for alignment / cohesion / sparation phases
/// ```
#[derive(PartialEq, Clone)]
struct Boid {
    position: Vec2,
    velocity: Vec2, //Velocity
    acceleration: Vec2,
    max_speed: f32, //Generation Speed
    max_force: f32, //Alignment / Cohesion / Separation

                    /*

                        1. Steer = desired - velocity
                        2. Steering is a group behaviour
                        3. Combine and weight multiple forces

                    */
}

impl Boid {
    fn spawn() -> Self {
        Boid {
            position: Vec2::new(
                fastrand::f32() * 1200.0, // Random x: 0.0 to 1200.0
                fastrand::f32() * 800.0,  // Random y: 0.0 to 800.0
            ),
            velocity: Vec2::new(
                (fastrand::f32() - 0.5) * 4.0, // Random velocity: -2.0 to 2.0
                (fastrand::f32() - 0.5) * 4.0,
            ),
            acceleration: Vec2::ZERO,
            max_speed: MAX_SPEED,
            max_force: MAX_FORCE,
        }
    }

    ///Each boid will self-manage according to separation/cohesion/alignment rules
    fn run_with_delta(&mut self, boids: &Vec<Boid>, delta_time: f32) {
        let separation = self.separate(boids);
        let alignment = self.align(boids);
        let cohesion = self.cohere(boids);
        let unblock = self.view_unblocking(boids);

        let separation = separation * 1.5; // Increase separation for cleaner flocks
        let alignment = alignment * 1.0; // Keep moderate alignment
        let cohesion = cohesion * 1.2; // Increase cohesion for tighter groups
        let unblock = unblock * 0.3; //Increase side-step decision making

        self.apply_force(separation);
        self.apply_force(alignment);
        self.apply_force(cohesion);
        self.apply_force(unblock);

        self.update_with_delta(delta_time);
    }

    fn apply_force(&mut self, force: Vec2) {
        self.acceleration += force;
    }

    fn update_with_delta(&mut self, delta_time: f32) {
        // Scale movement by delta time (60fps = ~0.0167 delta)
        let time_scale = delta_time * 60.0; // Normalize to 60fps equivalent

        self.velocity += self.acceleration * time_scale;
        self.velocity = self.velocity.clamp_length_max(self.max_speed);
        self.position += self.velocity * time_scale;

        // Wrap around screen edges
        if self.position.x < 0.0 {
            self.position.x = 1200.0;
        }
        if self.position.x > 1200.0 {
            self.position.x = 0.0;
        }
        if self.position.y < 0.0 {
            self.position.y = 800.0;
        }
        if self.position.y > 800.0 {
            self.position.y = 0.0;
        }

        self.acceleration = Vec2::ZERO;
    }

    fn seek(&self, target: Vec2) -> Vec2 {
        // Calculate desired velocity (target - current position)
        let desired = target - self.position;

        // Set magnitude to max speed
        let desired = desired.normalize() * self.max_speed;

        // Calculate steering force (desired - current velocity)
        let steer = desired - self.velocity;

        // Limit steering force
        steer.clamp_length_max(self.max_force)
    }

    fn separate(&self, boids: &Vec<Boid>) -> Vec2 {
        let desired_separation: f32 = 19.0; // Reduce for tighter groups

        let mut sum = Vec2::ZERO;
        let mut count = 0;
        for other in boids {
            let distance = self.position.distance(other.position);

            if self != other && distance > 0.0 && distance < desired_separation {
                let mut diff = self.position - other.position;
                diff = diff.normalize() / distance;

                sum += diff;
                count += 1;
            }
        }

        if count > 0 {
            sum /= count as f32; // Get average
            sum = sum.normalize() * self.max_speed;
            let steer = sum - self.velocity;
            let steer = steer.clamp_length_max(self.max_force);
            steer
        } else {
            Vec2::ZERO
        }
    }

    ///Helper function to calculate angle between two vec

    fn align(&self, boids: &Vec<Boid>) -> Vec2 {
        let desired_view_angle: f32 = 4.0 / 2.0; //170 degrees in radian (half as we are measuring from the center of your vision outward)
        let neighbour_distance = 50.0;

        let mut sum = Vec2::ZERO;
        let mut count = 0;

        //Add up all the velocities and divide by the total to calculate the average velocity
        for other in boids {
            //velocity vector tells us the facing direction
            let d1: Vec2 = self.velocity;

            //the firection from current boid to other boid
            let d2: Vec2 = other.position - self.position;

            //calculate angle between d1 and d2
            let angle = Vec2::angle_to(d1, d2).abs(); //we only care about full range so return absolute value (alwasy positive)

            let distance = self.position.distance(other.position);

            if self != other && angle < desired_view_angle && distance < neighbour_distance {
                sum += other.velocity;
                count += 1; //for an average, keep track of how many boids are within the distance
            }
        }

        if count > 0 {
            sum /= count as f32;
            sum = sum.normalize() * self.max_speed;

            let steer = sum - self.velocity;
            let steer = steer.clamp_length_max(self.max_force);
            steer
        } else {
            Vec2::ZERO //if no close boids are found, the steering force is zero
        }
    }

    fn cohere(&self, boids: &Vec<Boid>) -> Vec2 {
        let neighbour_distance: f32 = 40.0; // Increase for stronger grouping

        let mut sum = Vec2::ZERO;
        let mut count = 0;
        for other in boids {
            let distance = self.position.distance(other.position);
            if self != other && distance < neighbour_distance {
                sum += other.position;
                count += 1;
            }
        }
        if count > 0 {
            sum /= count as f32;
            self.seek(sum)
        } else {
            Vec2::ZERO
        }
    }

    fn view_unblocking(&self, boids: &Vec<Boid>) -> Vec2 {
        let desired_view_angle: f32 = 0.6 / 2.0;
        let mut blocking_severity = 0.0;

        // Calculate how "blocked" we are (gradual instead of binary)
        for other in boids {
            let d1: Vec2 = self.velocity;
            let d2: Vec2 = other.position - self.position;
            let angle = Vec2::angle_to(d1, d2).abs();
            let distance = self.position.distance(other.position);

            if self != other && angle < desired_view_angle && distance < 40.0 {
                // Closer and more centered = more blocking
                let angle_factor = 1.0 - (angle / desired_view_angle);
                let distance_factor = 1.0 - (distance / 40.0);
                blocking_severity += angle_factor * distance_factor;
            }
        }

        if blocking_severity < 0.3 {
            // Threshold to avoid micro-movements
            return Vec2::ZERO;
        }

        let d1: Vec2 = self.velocity.normalize();
        let lateral_right = Vec2::new(d1.y, -d1.x);
        let lateral_left = Vec2::new(-d1.y, d1.x);

        // Simple left/right evaluation
        let look_ahead = 25.0;
        let right_pos = self.position + (lateral_right * look_ahead);
        let left_pos = self.position + (lateral_left * look_ahead);

        let mut right_crowding = 0;
        let mut left_crowding = 0;

        for other in boids {
            if self != other {
                if right_pos.distance(other.position) < 20.0 {
                    right_crowding += 1;
                }
                if left_pos.distance(other.position) < 20.0 {
                    left_crowding += 1;
                }
            }
        }

        let chosen_direction = if left_crowding < right_crowding {
            lateral_left
        } else {
            lateral_right
        };

        // Force scales with blocking severity (gradual response)
        let base_strength = 0.2;
        let severity_multiplier = (blocking_severity * 2.0).min(1.0);

        chosen_direction * base_strength * severity_multiplier * self.max_force
    }
}

///The Flock struct is a collection of Vec<Boid> associated with a flockid
#[wasm_bindgen]
struct Flock {
    flockid: usize,   //For flock-level control
    boids: Vec<Boid>, //The vec of each boid within this flock
}

#[wasm_bindgen]
impl Flock {
    #[wasm_bindgen(constructor)]
    pub fn new(amt: usize) -> Flock {
        //create n boids
        let mut boids: Vec<Boid> = Vec::with_capacity(amt);
        for i in 0..amt {
            let boid: Boid = Boid::spawn();
            boids.push(boid); //push boid into boid vec
        }

        //return the flock
        Flock {
            flockid: 1, //TODO: Add a unique denominator here
            boids: boids,
        }
    }

    #[wasm_bindgen]
    pub fn update_with_delta(&mut self, delta_time: f32) {
        let boids_clone = self.boids.clone();
        for boid in &mut self.boids {
            boid.run_with_delta(&boids_clone, delta_time);
        }
    }

    #[wasm_bindgen]
    pub fn get_positions(&self) -> Vec<f32> {
        let mut positions = Vec::new();
        for boid in &self.boids {
            positions.push(boid.position.x);
            positions.push(boid.position.y);
        }
        positions
    }
}

//WASM WRAPPER
#[wasm_bindgen]
pub fn setup() {
    //Run this initialisation
    let flock: Flock = Flock::new(600); //Create a new flock with n boids
}
