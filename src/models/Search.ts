export type AdvancedSearchOption = 'all' | 'any' | 'none';
export type ValueType = 'string' | 'boolean' | 'integer' | 'decimal' | 'dateTime';

// 0=Is, 1=StartsWith, 2=EndsWith, 3=IsNot, 4=Contains, 5=IsNullOrEmpty
// 21=GT, 22=GTE, 23=LT, 24=LTE (numeric)
// 31=DateGT, 32=DateGTE, 33=DateLT, 34=DateLTE
export type ComparisonType = 0 | 1 | 2 | 3 | 4 | 5 | 21 | 22 | 23 | 24 | 31 | 32 | 33 | 34;

export interface ICriteria {
  propertyDefinitionId: string;
  comparisonType: ComparisonType;
  value: string;
  valueType: ValueType;
}

export interface SearchDataObject {
  searchTerm: string;
  criteria: ICriteria[];
  advancedSearchOption: AdvancedSearchOption;
}

export interface SortOption {
  field: string;
  descending: boolean;
}

export interface SearchResultDoc {
  id: number;
  name: string;
  author: string;
  fileType: string;
  recordType: string;
  fileSizeBytes: number;
  createdAt: string;
  updatedAt: string;
  // merged from content search
  snippet?: string;
  matchCount?: number;
}

export interface ContentSearchResult {
  id: number;
  name: string;
  snippet: string;
  matchCount: number;
}

export interface PropertyDefinition {
  id: string;
  label: string;
  valueType: ValueType;
}

export const PROPERTY_DEFINITIONS: PropertyDefinition[] = [
  { id: 'name',          label: 'File Name',         valueType: 'string'   },
  { id: 'author',        label: 'Author',             valueType: 'string'   },
  { id: 'recordType',    label: 'Record Type',        valueType: 'string'   },
  { id: 'fileType',      label: 'File Extension',     valueType: 'string'   },
  { id: 'fileSizeBytes', label: 'File Size (bytes)',  valueType: 'integer'  },
  { id: 'createdAt',     label: 'Created Date',       valueType: 'dateTime' },
  { id: 'updatedAt',     label: 'Modified Date',      valueType: 'dateTime' },
];

export const OPERATORS_BY_TYPE: Record<ValueType, { value: ComparisonType; label: string }[]> = {
  string: [
    { value: 4,  label: 'Contains'       },
    { value: 0,  label: 'Is'             },
    { value: 3,  label: 'Is Not'         },
    { value: 1,  label: 'Starts With'    },
    { value: 2,  label: 'Ends With'      },
    { value: 5,  label: 'Is Empty'       },
  ],
  boolean: [
    { value: 0, label: 'Is' },
    { value: 3, label: 'Is Not' },
  ],
  integer: [
    { value: 0,  label: 'Equals'             },
    { value: 21, label: 'Greater Than'       },
    { value: 22, label: 'Greater or Equal'   },
    { value: 23, label: 'Less Than'          },
    { value: 24, label: 'Less or Equal'      },
  ],
  decimal: [
    { value: 0,  label: 'Equals'             },
    { value: 21, label: 'Greater Than'       },
    { value: 22, label: 'Greater or Equal'   },
    { value: 23, label: 'Less Than'          },
    { value: 24, label: 'Less or Equal'      },
  ],
  dateTime: [
    { value: 31, label: 'After'              },
    { value: 32, label: 'On or After'        },
    { value: 33, label: 'Before'             },
    { value: 34, label: 'On or Before'       },
    { value: 0,  label: 'Is'                 },
  ],
};
