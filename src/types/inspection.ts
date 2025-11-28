export type YesNoString = 'Yes' | 'No' | '' | string;

export type InspectionApiResponse = {
  status: boolean;
  message: string;
  data: {
    count: number;
    allInspections: InspectionRecord[];
  };
};

export type InspectionRecord = {
  id: number;
  ownedVehiclesId: number | null;
  sellCarId: number | string;
  completed?: Record<string, boolean>;
  engine?: EngineInspection;
  exterior?: ExteriorInspection;
  interior?: InteriorInspection;
  frames?: FramesInspection;
  functions?: FunctionsInspection;
  testDrive?: any;
  [key: string]: any;
};

export type EngineInspection = {
  working?: {
    Engine?: YesNoString;
    Radiator?: YesNoString;
    Silencer?: YesNoString;
    'Starter Motor'?: YesNoString;
    'Engine Oil Level'?: YesNoString;
    'Coolant Availability'?: YesNoString;
    'Engine Mounting'?: YesNoString;
    Battery?: YesNoString;
    'Refurbishment Cost'?: string | number;
    'Engine image'?: string;
  };
  'noise/leakage'?: {
    'Engine Oil Leakage'?: YesNoString;
    'Coolant Oil Leakage'?: YesNoString;
    'Abnormal Noise'?: YesNoString;
    'Black Smoke/White Smoke'?: YesNoString;
    'Defective Belts'?: YesNoString;
    'Highlight Positives'?: string;
    'Other Comments'?: string;
  };
  'Refurbishment Cost (Total)'?: string | number;
};

export type ExteriorInspection = {
  [panel: string]:
    | {
        image?: string;
        scratch?: string;
      }
    | any;
};

export type InteriorInspection = {
  available?: Record<string, any>;
  working?: Record<string, any>;
  [key: string]: any;
};

export type FunctionsInspection = {
  proper_condition?: Record<string, YesNoString>;
  'proper_condition '?: Record<string, YesNoString>;
  'noise/leakage'?: Record<string, YesNoString>;
  'Highlight Positives'?: string;
  'Other Comments'?: string;
  'Refurbishment Cost'?: string | number;
  [key: string]: any;
};

export type FramesInspection = {
  'Any Damage In'?: FramesAnyDamage;
  'Any damage in'?: FramesAnyDamage;
  anyDamageIn?: FramesAnyDamage;
  anyDamage?: FramesAnyDamage;
  Front?: FramesAnyDamage['Front'];
  front?: FramesAnyDamage['Front'];
  Pillars?: FramesAnyDamage['Pillars'];
  pillars?: FramesAnyDamage['Pillars'];
  Rear?: FramesAnyDamage['Rear'];
  rear?: FramesAnyDamage['Rear'];
  'Flood Affected Vehicle'?: YesNoString;
  frameImages?: string[];
  'Frame images'?: string[];
  images?: string[];
  [key: string]: any;
};

export type FramesAnyDamage = {
  Front?: {
    'Bonnet Support Member'?: YesNoString;
    'Cross Member'?: YesNoString;
    'Lamp Support'?: YesNoString;
    'Left Apron'?: YesNoString;
    'Right Apron'?: YesNoString;
    [key: string]: any;
  };
  Pillars?: {
    'Left A-Pillar'?: YesNoString;
    'Left B-Pillar'?: YesNoString;
    'Left B-Pillar Details'?: string;
    'Left C-Pillar'?: YesNoString;
    'Left C-Pillar Details'?: string;
    'Right A-Pillar'?: YesNoString;
    'Right B-Pillar'?: YesNoString;
    'Right B-Pillar Details'?: string;
    'Right C-Pillar'?: YesNoString;
    'Right C-Pillar Details'?: string;
    [key: string]: any;
  };
  Rear?: {
    'Rear Left Quarter Panel'?: YesNoString;
    'Rear Right Quarter Panel'?: YesNoString;
    Dickey?: YesNoString;
    [key: string]: any;
  };
};
