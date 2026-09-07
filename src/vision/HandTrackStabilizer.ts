import type { NormalizedLandmark } from "@mediapipe/tasks-vision";
import { OneEuroFilter, type OneEuroParameters } from "./OneEuroFilter";
import type { DetectedHand, VisionFrame } from "./types";

const PALM_LANDMARKS = [0, 5, 9, 13, 17] as const;
const MAX_MISSING_RESULTS = 6;
const MAX_MATCH_DISTANCE = 0.32;

// Normalized coordinates move through a much smaller numeric range than
// pixels. These settings deliberately filter a resting fingertip, then open
// the cutoff aggressively during a slash to avoid the heavy/late feeling of a
// moving average.
const BLADE_FILTER: OneEuroParameters = {
  frequency: 30,
  minCutoff: 4,
  beta: 10,
  derivativeCutoff: 1,
};

const LANDMARK_FILTER: OneEuroParameters = {
  frequency: 30,
  minCutoff: 2.8,
  beta: 1.8,
  derivativeCutoff: 1,
};

interface Point2D {
  x: number;
  y: number;
}

interface LandmarkFilters {
  x: OneEuroFilter;
  y: OneEuroFilter;
  z: OneEuroFilter;
}

interface HandSlot {
  id: string;
  center: Point2D;
  velocity: Point2D;
  lastTimestamp: number;
  missingResults: number;
  filters: LandmarkFilters[];
}

interface Detection {
  hand: DetectedHand;
  center: Point2D;
  index: number;
}

interface CandidateMatch {
  slotIndex: number;
  detectionIndex: number;
  distance: number;
}

/**
 * Keeps filters attached to physical hands instead of MediaPipe's left/right
 * category. That category can flip between frames, which otherwise swaps two
 * filter histories and makes the blade visibly jump.
 */
export class HandTrackStabilizer {
  private slots: HandSlot[] = [];
  private nextSlotId = 0;

  stabilize(frame: VisionFrame): VisionFrame {
    for (const slot of this.slots) slot.missingResults += 1;

    const detections = frame.hands.map((hand, index) => ({
      hand,
      center: palmCenter(hand.landmarks),
      index,
    }));
    const assignments = this.matchDetections(detections, frame.timestamp);
    const stabilizedHands: DetectedHand[] = [];

    for (const detection of detections) {
      let slot = assignments.get(detection.index);
      if (!slot) {
        slot = this.createSlot(detection.center, frame.timestamp, detection.hand.landmarks.length);
        this.slots.push(slot);
      }

      // Keep the identity briefly through a one-frame miss, but discard stale
      // filter history after a longer loss so reacquisition cannot drag the
      // blade from its old position.
      if (slot.missingResults > 2 || slot.filters.length !== detection.hand.landmarks.length) {
        slot.filters = createLandmarkFilters(detection.hand.landmarks.length);
      }

      const dt = Math.min(0.2, Math.max(0.001, (frame.timestamp - slot.lastTimestamp) / 1000));
      const instantVelocity = {
        x: (detection.center.x - slot.center.x) / dt,
        y: (detection.center.y - slot.center.y) / dt,
      };
      slot.velocity.x += (instantVelocity.x - slot.velocity.x) * 0.55;
      slot.velocity.y += (instantVelocity.y - slot.velocity.y) * 0.55;
      slot.center = detection.center;
      slot.lastTimestamp = frame.timestamp;
      slot.missingResults = 0;

      const landmarks = detection.hand.landmarks.map((landmark, index) => {
        const filters = slot!.filters[index];
        return {
          ...landmark,
          x: filters.x.filter(landmark.x, frame.timestamp),
          y: filters.y.filter(landmark.y, frame.timestamp),
          z: filters.z.filter(landmark.z, frame.timestamp),
        };
      });

      stabilizedHands.push({
        ...detection.hand,
        id: slot.id,
        landmarks,
      });
    }

    this.slots = this.slots.filter((slot) => slot.missingResults <= MAX_MISSING_RESULTS);
    return { ...frame, hands: stabilizedHands };
  }

  reset(): void {
    this.slots = [];
    this.nextSlotId = 0;
  }

  private matchDetections(detections: Detection[], timestamp: number): Map<number, HandSlot> {
    const candidates: CandidateMatch[] = [];

    this.slots.forEach((slot, slotIndex) => {
      const elapsed = Math.min(0.12, Math.max(0, (timestamp - slot.lastTimestamp) / 1000));
      const predictedCenter = {
        x: slot.center.x + slot.velocity.x * elapsed,
        y: slot.center.y + slot.velocity.y * elapsed,
      };
      detections.forEach((detection) => {
        candidates.push({
          slotIndex,
          detectionIndex: detection.index,
          distance: Math.hypot(
            detection.center.x - predictedCenter.x,
            detection.center.y - predictedCenter.y,
          ),
        });
      });
    });

    candidates.sort((left, right) => left.distance - right.distance);
    const usedSlots = new Set<number>();
    const usedDetections = new Set<number>();
    const assignments = new Map<number, HandSlot>();

    for (const candidate of candidates) {
      if (candidate.distance > MAX_MATCH_DISTANCE) break;
      if (usedSlots.has(candidate.slotIndex) || usedDetections.has(candidate.detectionIndex)) continue;
      usedSlots.add(candidate.slotIndex);
      usedDetections.add(candidate.detectionIndex);
      assignments.set(candidate.detectionIndex, this.slots[candidate.slotIndex]);
    }

    return assignments;
  }

  private createSlot(center: Point2D, timestamp: number, landmarkCount: number): HandSlot {
    return {
      id: `hand-${this.nextSlotId++}`,
      center,
      velocity: { x: 0, y: 0 },
      lastTimestamp: timestamp,
      missingResults: 0,
      filters: createLandmarkFilters(landmarkCount),
    };
  }
}

function palmCenter(landmarks: NormalizedLandmark[]): Point2D {
  let x = 0;
  let y = 0;
  let count = 0;
  for (const index of PALM_LANDMARKS) {
    const landmark = landmarks[index];
    if (!landmark) continue;
    x += landmark.x;
    y += landmark.y;
    count += 1;
  }
  if (count === 0) return { x: 0.5, y: 0.5 };
  return { x: x / count, y: y / count };
}

function createLandmarkFilters(count: number): LandmarkFilters[] {
  return Array.from({ length: count }, (_, index) => {
    const parameters = index === 8 ? BLADE_FILTER : LANDMARK_FILTER;
    return {
      x: new OneEuroFilter(parameters),
      y: new OneEuroFilter(parameters),
      z: new OneEuroFilter(parameters),
    };
  });
}
