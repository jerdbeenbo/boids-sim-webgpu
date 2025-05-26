use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};

const MAX_SPEED: f32 = 10.0;
const MAX_FORCE: f32 = 20.0;

///The "Boid" is the individual bird that when combined, creates a complex
/// flocking behaviour system
/// #### Params
/// ```
/// x: f32, y: f32 -> x,y positions along the 2D plane
/// vx: f32, vy: f32 -> directional x,y velocity
/// max_speed: f32 -> maximum speed the boid can go
/// max_force: f32 -> force applied for alignment / cohesion / sparation phases
/// ```
struct Boid {
    x: f32,             //x Pos
    y: f32,             //Y pos
    velocity: f32,      //Velocity
    max_speed: f32,     //Generation Speed
    max_force: f32,     //Alignment / Cohesion / Separation

    /*
    
        1. Steer = desired - velocity
        2. Steering is a group behaviour
        3. Combine and weight multiple forces

    */
}

impl Boid {
    fn spawn() -> Self {
        Boid { 
            x: 0.0, 
            y: 0.0, 
            velocity: 0.0, 
            max_speed: MAX_SPEED, 
            max_force: MAX_FORCE }
    }

    ///Each boid will self-manage according to separation/cohesion/alignment rules
    fn run(&mut self, boids: &Vec<Boid>) {
        //separation, alignmnet and cohesion
        let mut separation = self.seperate(boids);     //pass in itself, and reference to the other boids
        let mut alignment = self.align(boids);
        let mut cohesion = self.cohere(boids);

        separation *= 1.5;                              //Fine tune with arbitrary weights
        alignment *= 1.0;
        cohesion *= 1.0;

        self.applyForce(separation);
        self.applyForce(alignment);
        self.applyForce(cohesion);
    }

    fn align(boid: Boid, boids: &Vec<Boid>) {
        let mut sum = Vec2::new(0.0, 0.0);

        //Add up all the velocities and divide by the total to calculate the average velocity
        for other in boids {
            sum += other.velocity;
        }

        sum /= boids.len() as f32;
        sum

    }
}

///The Flock struct is a collection of Vec<Boid> associated with a flockid
struct Flock {
    flockid: usize,         //For flock-level control
    boids: Vec<Boid>,       //The vec of each boid within this flock
}

impl Flock {
    fn new(amt: usize) -> Flock {

        //create n boids
        let mut boids: Vec<Boid> = Vec::with_capacity(amt);
        for i in 0..amt {
            let boid: Boid = Boid::spawn();
            boids.push(boid);   //push boid into boid vec
        }

        //return the flock
        Flock {
            flockid: 1,         //TODO: Add a unique denominator here
            boids: boids,
        }

    }

    ///
    fn run(&mut self) {
        for boid in &mut self.boids {
            boid.run(&self.boids)
        }
    }
}

///'Master function' that handles all flocking behaviour
fn flock (boids: Vec<Boid>) {
    let separation = this.separate(boids)
}

//WASM WRAPPER
#[wasm_bindgen]
pub fn setup() {
    //Run this initialisation
    let flock: Flock = Flock::new(120);      //Create a new flock with n boids
}



