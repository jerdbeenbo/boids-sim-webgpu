let MAX_SPEED: f32 = 6.0;
let MAX_FORCE: f32 = 0.9; //How sharp or smooth they turn

let GRID_RESOLUTION: u32 = 40; //each cell is 40x40 pixels
let WIDTH: u32 = 1200;
let HEIGHT: u32 = 800;

let COLS: u32 = WIDTH / GRID_RESOLUTION;
let ROWS: u32 = HEIGHT / GRID_RESOLUTION;

struct Boid {
    position: vec2f,
    velocity: vec2f, //Velocity
    acceleration: vec2f,
    max_speed: f32, //Generation Speed
    max_force: f32, //Alignment / Cohesion / Separation
}

@group(0) @binding(0) var<storage, read_write> boids: array<Boid>;  //read_write is need


fn seek(index: u32, target: vec2f) -> vec2f {
    // Calculate desired velocity (target - current position)
    let desired = target - boids[index].position;

    // Safe normalization check
    if desired.length() < 0.001 {
        return vec2f(0,0);  //don't provide any force
    }

    // Set magnitude to max speed
    let desired = desired.normalize() * MAX_SPEED;

    // Calculate steering force (desired - current velocity)
    let steer = desired - boids[index].velocity;

    // Limit steering force
    let steer_result = steer.clamp_length_max(MAX_FORCE);

    return steer_result;
}

fn separate(index: u32, boids: array<Boid>) -> vec2f {

    let desired_separation: f32 = 19.0;
    var sum = vec2f::ZERO;
    var count = 0;

    for(var other = 0; other < boids.lenght(); other++) {
            
        let distance = self.position.distance(other.position);

            if self != other && distance > 0.001 && distance < desired_separation {
                // Added minimum distance check
                let mut diff = self.position - other.position;

                // Safe normalization
                if diff.length() > 0.001 {
                    diff = diff.normalize() / distance;
                    sum += diff;
                    count += 1;
                }
            }
        }

        if count > 0 {
            sum /= count as f32;

            // Safe normalization
            if sum.length() > 0.001 {
                sum = sum.normalize() * self.max_speed;
                let steer = sum - self.velocity;
                steer.clamp_length_max(self.max_force)
            } else {
                vec2f::ZERO
            }
        } else {
            vec2f::ZERO
        }
    }

    ///Helper function to calculate angle between two vec

    fn align(&self, boids: &Vec<Boid>) -> vec2f {
        let desired_view_angle: f32 = 4.0 / 2.0; //170 degrees in radian (half as we are measuring from the center of your vision outward)
        let neighbour_distance = 50.0;

        let mut sum = vec2f::ZERO;
        let mut count = 0;

        //Add up all the velocities and divide by the total to calculate the average velocity
        for other in boids {
            //velocity vector tells us the facing direction
            let d1: vec2f = self.velocity;

            //the firection from current boid to other boid
            let d2: vec2f = other.position - self.position;

            //calculate angle between d1 and d2
            let angle = vec2f::angle_to(d1, d2).abs(); //we only care about full range so return absolute value (alwasy positive)

            let distance = self.position.distance(other.position);

            if self != other && angle < desired_view_angle && distance < neighbour_distance {
                sum += other.velocity;
                count += 1; //for an average, keep track of how many boids are within the distance
            }
        }

        if count > 0 {
            sum /= count as f32;
            if sum.length() > 0.001 {
                sum = sum.normalize() * self.max_speed;
            } else {
                sum = vec2f::ZERO;
            }

            let steer = sum - self.velocity;
            let steer = steer.clamp_length_max(self.max_force);
            steer
        } else {
            vec2f::ZERO //if no close boids are found, the steering force is zero
        }
    }

    fn cohere(&self, boids: &Vec<Boid>) -> vec2f {
        let neighbour_distance: f32 = 40.0; // Increase for stronger grouping

        let mut sum = vec2f::ZERO;
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
            vec2f::ZERO
        }
    }

