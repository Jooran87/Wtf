// Ajoneuvot: jäykkinä kappaleina mallinnetut testikuormat.

import { Engine } from './engine';
import { VehicleId } from './types';

export interface VehicleInfo {
  name: string;
  emoji: string;
  totalMass: number;
}

interface UnitSpec {
  kind: 'car' | 'van' | 'truck' | 'loco' | 'wagon';
  /** Ensimmäisen ja viimeisen akselin väli metreinä */
  wheelBase: number;
  /** Akselien määrä (pyörät jaetaan tasavälein akselivälille) */
  axles: number;
  wheelR: number;
  wheelMass: number;
  /** Korisolmujen ylitys akseleista ja korkeus */
  overhang: number;
  bodyH: number;
  bodyMass: number;
  speed: number;
  driven: boolean;
  color: string;
}

const UNITS: Record<UnitSpec['kind'], UnitSpec> = {
  car: { kind: 'car', wheelBase: 1.6, axles: 2, wheelR: 0.26, wheelMass: 450, overhang: 0.2, bodyH: 0.7, bodyMass: 350, speed: 3.2, driven: true, color: '#c94f3d' },
  van: { kind: 'van', wheelBase: 2.0, axles: 2, wheelR: 0.3, wheelMass: 650, overhang: 0.3, bodyH: 0.95, bodyMass: 450, speed: 2.8, driven: true, color: '#3d7dc9' },
  truck: { kind: 'truck', wheelBase: 2.4, axles: 2, wheelR: 0.34, wheelMass: 1250, overhang: 0.3, bodyH: 1.05, bodyMass: 850, speed: 2.4, driven: true, color: '#c9963d' },
  loco: { kind: 'loco', wheelBase: 2.2, axles: 3, wheelR: 0.3, wheelMass: 1500, overhang: 0.4, bodyH: 1.05, bodyMass: 1250, speed: 2.0, driven: true, color: '#8c2f2f' },
  wagon: { kind: 'wagon', wheelBase: 1.8, axles: 2, wheelR: 0.3, wheelMass: 1100, overhang: 0.3, bodyH: 0.85, bodyMass: 700, speed: 2.0, driven: false, color: '#5c4a38' },
};

function unitsFor(id: VehicleId): UnitSpec[] {
  switch (id) {
    case 'car':
      return [UNITS.car];
    case 'van':
      return [UNITS.van];
    case 'truck':
      return [UNITS.truck];
    case 'train0':
      return [UNITS.loco];
    case 'train1':
      return [UNITS.loco, UNITS.wagon];
    case 'train2':
      return [UNITS.loco, UNITS.wagon, UNITS.wagon];
  }
}

export function vehicleInfo(id: VehicleId): VehicleInfo {
  const units = unitsFor(id);
  const totalMass = units.reduce((s, u) => s + u.axles * u.wheelMass + 2 * u.bodyMass, 0);
  const names: Record<VehicleId, [string, string]> = {
    car: ['Henkilöauto', '🚗'],
    van: ['Pakettiauto', '🚐'],
    truck: ['Kuorma-auto', '🚚'],
    train0: ['Veturi', '🚂'],
    train1: ['Juna + 1 vaunu', '🚂'],
    train2: ['Juna + 2 vaunua', '🚂'],
  };
  return { name: names[id][0], emoji: names[id][1], totalMass };
}

/**
 * Luo ajoneuvon moottoriin. frontX = etupyörän x, groundY = pinnan y.
 * Junassa vaunut sijoittuvat veturin taakse (vasemmalle), tarvittaessa
 * maailman ulkopuolelle — kalliolaatikot jatkuvat sinne.
 */
export function spawnVehicle(engine: Engine, id: VehicleId, frontX: number, groundY: number) {
  const units = unitsFor(id);
  const GAP = 0.8;
  // Yksiköiden kokonaispituudet sijoittelua varten (etupyörästä taaksepäin)
  let cursor = frontX;
  const couplings: { prevRear: number; front: number }[] = [];
  let prevRearChassis = -1;
  let prevRearWheel = -1;

  for (const u of units) {
    const axleY = groundY - u.wheelR;
    const bodyY = axleY - u.bodyH;
    const frontWheelX = cursor;
    const rearWheelX = cursor - u.wheelBase;

    // Pyörät tasavälein etu- ja taka-akselin välille
    const wheels: number[] = [];
    for (let a = 0; a < u.axles; a++) {
      const x = frontWheelX - (u.wheelBase * a) / (u.axles - 1);
      wheels.push(engine.addNode(x, axleY, u.wheelMass, { radius: u.wheelR, vehicle: true }));
    }
    const cF = engine.addNode(frontWheelX + u.overhang, bodyY, u.bodyMass, { vehicle: true });
    const cR = engine.addNode(rearWheelX - u.overhang, bodyY, u.bodyMass, { vehicle: true });

    // Täysi sidosverkko pitää yksikön jäykkänä
    const all = [...wheels, cF, cR];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) engine.addRigidLink(all[i], all[j]);
    }

    engine.segments.push({
      wheels,
      chassis: [cR, cF],
      drive: u.driven ? wheels : [],
      speed: u.speed,
      color: u.color,
      kind: u.kind,
    });

    if (prevRearChassis >= 0) {
      // Kytkin edelliseen yksikköön: kaksi sidosta pitää vaunun suorassa
      engine.addRigidLink(prevRearChassis, cF);
      engine.addRigidLink(prevRearWheel, wheels[0]);
    }
    prevRearChassis = cR;
    prevRearWheel = wheels[wheels.length - 1];
    cursor = rearWheelX - u.overhang * 2 - GAP;
  }
}
