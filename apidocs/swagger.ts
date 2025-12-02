export const swaggerDocument = {
  openapi: '3.0.3',
  info: {
    title: 'TSL Scanner Server API',
    description:
      'API for ingesting scanner payloads, routing rows to Prisma and train tabs, and exposing aggregated totals plus override helpers.',
    version: '1.0.0',
  },
  servers: [
    {
      url: 'http://localhost:3800/api',
      description: 'Local development server',
    },
  ],
  security: [
    {
      ApiKeyAuth: [],
    },
  ],
  tags: [
    {
      name: 'Scans',
      description: 'Upload scanner batches',
    },
    {
      name: 'Prismas',
      description: 'Track Prisma tables and manual overrides',
    },
    {
      name: 'Trains',
      description: 'Track Train tables and manual overrides',
    },
    {
      name: 'Admin',
      description: 'Build UI controls to manage Prisma & Producent data',
    },
  ],
  paths: {
    '/scans': {
      post: {
        tags: ['Scans'],
        summary: 'Append scans and optionally sync a Prisma or train sheet',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ScanPayload',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Rows appended and Prisma summary synced',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ScanResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid payload',
          },
          '502': {
            description: 'Failed to persist scans',
          },
        },
      },
    },
    '/prismas': {
      get: {
        tags: ['Prismas'],
        summary: 'List all Prisma summaries',
        responses: {
          '200': {
            description: 'Returns a list of Prisma totals',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PrismaSummariesResponse',
                },
              },
            },
          },
          '502': {
            description: 'Failed to load Prisma data',
          },
        },
      },
    },
    '/prismas/{prismaName}': {
      get: {
        tags: ['Prismas'],
        summary: 'Retrieve a single Prisma summary by name',
        parameters: [
          {
            name: 'prismaName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Case-insensitive Prisma table name (e.g. "prisma 5")',
          },
        ],
        responses: {
          '200': {
            description: 'Prisma summary',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PrismaSummary',
                },
              },
            },
          },
          '404': {
            description: 'Prisma table not found',
          },
          '502': {
            description: 'Failed to load Prisma summary',
          },
        },
      },
    },
    '/prismas/{prismaName}/refresh': {
      post: {
        tags: ['Prismas'],
        summary: 'Recalculate the scanned total for a Prisma table',
        parameters: [
          {
            name: 'prismaName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Prisma table to recount (ex: "prisma 3")',
          },
        ],
        responses: {
          '200': {
            description: 'Latest total count',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PrismaRefreshResponse',
                },
              },
            },
          },
          '502': {
            description: 'Failed to refresh Prisma summary',
          },
        },
      },
    },
    '/prismas/{prismaName}/fact': {
      patch: {
        tags: ['Prismas'],
        summary: 'Manually update the fact scanned value',
        parameters: [
          {
            name: 'prismaName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Prisma table identifier',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrismaFactUpdateRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Fact scanned total persisted',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PrismaFactUpdateResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
          },
          '502': {
            description: 'Failed to update fact scanned value',
          },
        },
      },
    },
    '/trains': {
      get: {
        tags: ['Trains'],
        summary: 'List all Train summaries',
        responses: {
          '200': {
            description: 'Returns a list of Train totals',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainSummariesResponse',
                },
              },
            },
          },
          '502': {
            description: 'Failed to load Train data',
          },
        },
      },
    },
    '/trains/{trainName}': {
      get: {
        tags: ['Trains'],
        summary: 'Retrieve a single Train summary by name',
        parameters: [
          {
            name: 'trainName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Case-insensitive Train table name (e.g. "train G")',
          },
        ],
        responses: {
          '200': {
            description: 'Train summary',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainSummary',
                },
              },
            },
          },
          '404': {
            description: 'Train table not found',
          },
          '502': {
            description: 'Failed to load Train summary',
          },
        },
      },
    },
    '/trains/{trainName}/refresh': {
      post: {
        tags: ['Trains'],
        summary: 'Recalculate the scanned total for a Train table',
        parameters: [
          {
            name: 'trainName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Train sheet to recount (ex: "train G")',
          },
        ],
        responses: {
          '200': {
            description: 'Latest total count',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainRefreshResponse',
                },
              },
            },
          },
          '502': {
            description: 'Failed to refresh Train summary',
          },
        },
      },
    },
    '/trains/{trainName}/fact': {
      patch: {
        tags: ['Trains'],
        summary: 'Manually update the fact loaded value',
        parameters: [
          {
            name: 'trainName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Train sheet identifier',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TrainFactUpdateRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Fact loaded total persisted',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainFactUpdateResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
          },
          '502': {
            description: 'Failed to update fact loaded value',
          },
        },
      },
    },
    '/admin/overview': {
      get: {
        tags: ['Admin'],
        summary: 'Structured overview for admin dashboards',
        responses: {
          '200': {
            description: 'Prismas plus Producent snapshots',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminOverviewResponse',
                },
              },
            },
          },
          '502': {
            description: 'Failed to build overview',
          },
        },
      },
    },

    '/admin/prismas': {
      get: {
        tags: ['Admin'],
        summary: 'Admin-facing Prisma summary list',
        responses: {
          '200': {
            description: 'Prisma totals & fact-scanned overrides',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PrismaSummariesResponse',
                },
              },
            },
          },
          '502': {
            description: 'Failed to read Prisma summaries',
          },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a new Prisma summary entry',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdminPrismaCreateRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Prisma summary persisted',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PrismaSummary',
                },
              },
            },
          },
          '400': {
            description: 'Invalid Prisma payload',
          },
          '409': {
            description: 'Prisma summary already exists',
          },
          '502': {
            description: 'Failed to create Prisma summary',
          },
        },
      },
    },

    '/admin/prismas/{prismaName}/refresh': {
      post: {
        tags: ['Admin'],
        summary: 'Rebuild the Prisma total count',
        parameters: [
          {
            name: 'prismaName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description:
              'Prisma sheet name; casing and missing prefix are normalized automatically (e.g. "4" becomes "prisma 4")',
          },
        ],
        responses: {
          '200': {
            description: 'Synced total plus the manual fact count (if configured)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminPrismaRefreshResponse',
                },
              },
            },
          },
          '502': {
            description: 'Failed to refresh Prisma summary',
          },
        },
      },
    },

    '/admin/prismas/{prismaName}/fact': {
      patch: {
        tags: ['Admin'],
        summary: 'Manual override for the fact scanned value',
        parameters: [
          {
            name: 'prismaName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Prisma sheet identifier that is normalized before saving.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/PrismaFactUpdateRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Fact scanned value stored',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PrismaFactUpdateResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
          },
          '502': {
            description: 'Failed to write fact scanned value',
          },
        },
      },
    },

    '/admin/prismas/{prismaName}': {
      get: {
        tags: ['Admin'],
        summary: 'Lookup a Prisma summary entry',
        parameters: [
          {
            name: 'prismaName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Prisma sheet identifier',
          },
        ],
        responses: {
          '200': {
            description: 'Prisma summary',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PrismaSummary',
                },
              },
            },
          },
          '404': {
            description: 'Prisma summary not found',
          },
          '502': {
            description: 'Failed to load Prisma summary',
          },
        },
      },
      put: {
        tags: ['Admin'],
        summary: 'Update Prisma summary totals',
        parameters: [
          {
            name: 'prismaName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Prisma sheet identifier',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdminPrismaUpdateRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Prisma summary updated',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/PrismaSummary',
                },
              },
            },
          },
          '400': {
            description: 'Invalid update payload',
          },
          '404': {
            description: 'Prisma summary not found',
          },
          '502': {
            description: 'Failed to update Prisma summary',
          },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Remove a Prisma summary entry',
        parameters: [
          {
            name: 'prismaName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Prisma sheet identifier',
          },
        ],
        responses: {
          '200': {
            description: 'Prisma summary deleted',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminDeleteResponse',
                },
              },
            },
          },
          '404': {
            description: 'Prisma summary not found',
          },
          '502': {
            description: 'Failed to delete Prisma summary',
          },
        },
      },
    },

    '/admin/trains': {
      get: {
        tags: ['Admin'],
        summary: 'Admin-facing Train summary list',
        responses: {
          '200': {
            description: 'Train totals & fact-loaded overrides',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainSummariesResponse',
                },
              },
            },
          },
          '502': {
            description: 'Failed to read Train summaries',
          },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a new Train summary entry',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdminTrainCreateRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Train summary persisted',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainSummary',
                },
              },
            },
          },
          '400': {
            description: 'Invalid Train payload',
          },
          '409': {
            description: 'Train summary already exists',
          },
          '502': {
            description: 'Failed to create Train summary',
          },
        },
      },
    },

    '/admin/trains/{trainName}/refresh': {
      post: {
        tags: ['Admin'],
        summary: 'Rebuild the Train total count',
        parameters: [
          {
            name: 'trainName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description:
              'Train sheet name; casing and missing prefix are normalized automatically (e.g. "G" becomes "train G")',
          },
        ],
        responses: {
          '200': {
            description: 'Synced total plus the manual fact-loaded count',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminTrainRefreshResponse',
                },
              },
            },
          },
          '502': {
            description: 'Failed to refresh Train summary',
          },
        },
      },
    },

    '/admin/trains/{trainName}/fact': {
      patch: {
        tags: ['Admin'],
        summary: 'Manual override for the fact loaded value',
        parameters: [
          {
            name: 'trainName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Train sheet identifier',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/TrainFactUpdateRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Fact loaded value stored',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainFactUpdateResponse',
                },
              },
            },
          },
          '400': {
            description: 'Invalid request',
          },
          '502': {
            description: 'Failed to write fact loaded value',
          },
        },
      },
    },

    '/admin/trains/{trainName}': {
      get: {
        tags: ['Admin'],
        summary: 'Lookup a Train summary entry',
        parameters: [
          {
            name: 'trainName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Train sheet identifier',
          },
        ],
        responses: {
          '200': {
            description: 'Train summary',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainSummary',
                },
              },
            },
          },
          '404': {
            description: 'Train summary not found',
          },
          '502': {
            description: 'Failed to load Train summary',
          },
        },
      },
      put: {
        tags: ['Admin'],
        summary: 'Update Train summary details',
        parameters: [
          {
            name: 'trainName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Train sheet identifier',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdminTrainUpdateRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Train summary updated',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/TrainSummary',
                },
              },
            },
          },
          '400': {
            description: 'Invalid update payload',
          },
          '404': {
            description: 'Train summary not found',
          },
          '502': {
            description: 'Failed to update Train summary',
          },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Remove a Train summary entry',
        parameters: [
          {
            name: 'trainName',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Train sheet identifier',
          },
        ],
        responses: {
          '200': {
            description: 'Train summary deleted',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminDeleteResponse',
                },
              },
            },
          },
          '404': {
            description: 'Train summary not found',
          },
          '502': {
            description: 'Failed to delete Train summary',
          },
        },
      },
    },

    '/admin/producent': {
      get: {
        tags: ['Admin'],
        summary: 'List Producent barcode metadata',
        responses: {
          '200': {
            description:
              'Returns every barcode row with grade/size details, production identifiers, weight, count, latest scaned total, on-train accumulations, and the most recent train context',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ProducentEntriesResponse',
                },
              },
            },
          },
          '502': {
            description: 'Failed to read Producent data',
          },
        },
      },
    },

    '/admin/producent/{barcode}': {
      patch: {
        tags: ['Admin'],
        summary: 'Override the scaned column for a barcode',
        parameters: [
          {
            name: 'barcode',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Barcode value to edit',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ProducentUpdateRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated entry',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ProducentEntry',
                },
              },
            },
          },
          '400': {
            description: 'Invalid scaned value',
          },
          '502': {
            description: 'Failed to update Producent row',
          },
        },
      },
    },

    '/admin/export': {
      post: {
        tags: ['Admin'],
        summary: 'Download a configurable scan export workbook',
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdminScanExportRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'XLSX workbook download',
            content: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                schema: {
                  type: 'string',
                  format: 'binary',
                },
              },
            },
            headers: {
              'Content-Disposition': {
                description: 'Attachment header that suggests the filename',
                schema: {
                  type: 'string',
                },
              },
            },
          },
          '400': {
            description: 'Invalid export parameters',
          },
          '502': {
            description: 'Failed to generate export',
          },
        },
      },
    },

    '/admin/scans': {
      get: {
        tags: ['Admin'],
        summary: 'List stored scan records',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            schema: {
              type: 'number',
              default: 100,
              minimum: 1,
              maximum: 500,
            },
            description:
              'Maximum number of scans to return (values outside 1-500 are clamped)',
          },
          {
            name: 'page',
            in: 'query',
            schema: {
              type: 'number',
              default: 1,
              minimum: 1,
            },
            description: 'Page to fetch, 1-based (uses skip = (page-1)*limit)',
          },
        ],
        responses: {
          '200': {
            description: 'Recent scan rows',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminScanListResponse',
                },
              },
            },
          },
          '502': {
            description: 'Failed to read scans',
          },
        },
      },
      post: {
        tags: ['Admin'],
        summary: 'Create a scan row manually',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdminScanCreateRequest',
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Scan persisted',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminScanRecord',
                },
              },
            },
          },
          '400': {
            description: 'Invalid scan payload',
          },
          '502': {
            description: 'Failed to persist scan',
          },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete multiple scan rows',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdminScanBulkDeleteRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Scan rows deleted',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminScanBulkDeleteResponse',
                },
              },
            },
          },
          '400': {
            description: 'No scan IDs provided',
          },
          '502': {
            description: 'Failed to delete scans',
          },
        },
      },
    },

    '/admin/scans/{scanId}': {
      get: {
        tags: ['Admin'],
        summary: 'Retrieve a single scan row',
        parameters: [
          {
            name: 'scanId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Primary key for the scan record',
          },
        ],
        responses: {
          '200': {
            description: 'Scan details',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminScanRecord',
                },
              },
            },
          },
          '404': {
            description: 'Scan not found',
          },
          '502': {
            description: 'Failed to load scan',
          },
        },
      },
      put: {
        tags: ['Admin'],
        summary: 'Update an existing scan row',
        parameters: [
          {
            name: 'scanId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Primary key for the scan record',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/AdminScanUpdateRequest',
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated scan row',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminScanRecord',
                },
              },
            },
          },
          '400': {
            description: 'Invalid update payload',
          },
          '404': {
            description: 'Scan not found',
          },
          '502': {
            description: 'Failed to update scan',
          },
        },
      },
      delete: {
        tags: ['Admin'],
        summary: 'Delete a scan row',
        parameters: [
          {
            name: 'scanId',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'Primary key for the scan record',
          },
        ],
        responses: {
          '200': {
            description: 'Scan deleted',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/AdminDeleteResponse',
                },
              },
            },
          },
          '404': {
            description: 'Scan not found',
          },
          '502': {
            description: 'Failed to delete scan',
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'x-api-access',
        description: 'Access key that must match the server-side configuration',
      },
    },
    schemas: {
      ScanDevice: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Device identifier emitted by the scanner',
          },
          app: {
            type: 'string',
            description: 'Scanner application name',
          },
        },
        required: ['id', 'app'],
      },
      ScanRecord: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'Unique identifier for the scan event',
          },
          code: {
            type: 'string',
            description: 'Raw payload containing QR/barcode segments separated by semicolons',
          },
          labelType: {
            type: 'string',
            description: 'Label type produced by the scanner',
          },
          friendlyName: {
            type: 'string',
            description: 'Display name visible on the scanner screen',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
            description: 'ISO timestamp when the scan occurred',
          },
          source: {
            type: 'string',
            description: 'Origin (e.g. "scanner" or "webhook")',
          },
        },
        required: ['id', 'code', 'labelType', 'friendlyName', 'timestamp', 'source'],
      },
      ScanPayload: {
        type: 'object',
        properties: {
          device: {
            $ref: '#/components/schemas/ScanDevice',
          },
          scans: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ScanRecord',
            },
          },
          comment: {
            type: 'string',
          },
          prisma: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'number',
              },
            ],
            description: 'Optional prisma table identifier used for routing scan rows',
          },
          train: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'number',
              },
            ],
            description:
              'Optional train identifier (e.g. "G") that routes scans to the corresponding train sheet and updates Producent on-train counters',
          },
          wagon: {
            oneOf: [
              {
                type: 'string',
              },
              {
                type: 'number',
              },
            ],
            description:
              'Optional wagon identifier that can be used to mark which wagon the incoming scan was recorded from',
          },
        },
        required: ['device', 'scans'],
      },
      ScanResponse: {
        type: 'object',
        properties: {
          inserted: {
            type: 'number',
            description: 'Number of rows appended',
          },
          rows: {
            type: 'array',
            items: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
        },
      },
      PrismaSummary: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Spreadsheet tab name (prefixed with "prisma ")',
          },
          totalCount: {
            type: 'number',
            description: 'Automatically counted rows inside the Prisma tab',
          },
          factScanned: {
            type: 'number',
            description: 'Override value entered manually via the fact endpoint',
          },
        },
      },
      PrismaSummariesResponse: {
        type: 'object',
        properties: {
          prismas: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PrismaSummary',
            },
          },
        },
      },
      PrismaRefreshResponse: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
          totalCount: {
            type: 'number',
          },
        },
      },
      PrismaFactUpdateRequest: {
        type: 'object',
        properties: {
          factScanned: {
            type: 'number',
            description: 'Number of items counted manually in the Prisma tray',
          },
        },
        required: ['factScanned'],
      },
      PrismaFactUpdateResponse: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
          factScanned: {
            type: 'number',
          },
        },
      },
      TrainSummary: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Spreadsheet tab name (prefixed with "train ")',
          },
          totalCount: {
            type: 'number',
            description: 'Automatically counted rows inside the Train tab',
          },
          factLoaded: {
            type: 'number',
            description: 'Override value entered manually via the fact endpoint',
          },
        },
      },
      TrainSummariesResponse: {
        type: 'object',
        properties: {
          trains: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/TrainSummary',
            },
          },
        },
      },
      TrainRefreshResponse: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
          totalCount: {
            type: 'number',
          },
          factLoaded: {
            type: 'number',
          },
        },
      },
      TrainFactUpdateRequest: {
        type: 'object',
        properties: {
          factLoaded: {
            type: 'number',
            description: 'Number of items counted manually for the train load',
          },
        },
        required: ['factLoaded'],
      },
      TrainFactUpdateResponse: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
          factLoaded: {
            type: 'number',
          },
        },
      },
      AdminOverviewResponse: {
        type: 'object',
        properties: {
          prismas: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/PrismaSummary',
            },
          },
          producent: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ProducentEntry',
            },
          },
        },
      },
      AdminPrismaRefreshResponse: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
          totalCount: {
            type: 'number',
          },
          factScanned: {
            type: 'number',
          },
        },
      },
      AdminTrainRefreshResponse: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
          },
          totalCount: {
            type: 'number',
          },
          factLoaded: {
            type: 'number',
          },
        },
      },
      ProducentEntry: {
        type: 'object',
        properties: {
          barcode: {
            type: 'string',
          },
          grade: {
            type: 'string',
            nullable: true,
          },
          size: {
            type: 'string',
            nullable: true,
          },
          heatNo: {
            type: 'string',
            nullable: true,
          },
          rollingNo: {
            type: 'string',
            nullable: true,
          },
          markNo: {
            type: 'string',
            nullable: true,
          },
          actualWeight: {
            type: 'number',
            nullable: true,
          },
          pieces: {
            type: 'number',
            nullable: true,
          },
          onTrain: {
            type: 'number',
            description: 'Accumulated count of items reported while assigned to a train leg',
          },
          trainName: {
            type: 'string',
            nullable: true,
            description: 'Last train identifier captured alongside on-train scans',
          },
          wagonName: {
            type: 'string',
            nullable: true,
            description: 'Last wagon identifier captured alongside on-train scans',
          },
          scaned: {
            type: 'number',
          },
        },
      },
      ProducentEntriesResponse: {
        type: 'object',
        properties: {
          entries: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/ProducentEntry',
            },
          },
        },
      },
      ProducentUpdateRequest: {
        type: 'object',
        properties: {
          grade: {
            type: 'string',
            nullable: true,
            description: 'Optional grade text for the barcode',
          },
          size: {
            type: 'string',
            nullable: true,
            description: 'Optional size text for the barcode',
          },
          heatNo: {
            type: 'string',
            nullable: true,
            description: 'Heat number that can be assigned manually',
          },
          rollingNo: {
            type: 'string',
            nullable: true,
            description: 'Rolling number that can be assigned manually',
          },
          markNo: {
            type: 'string',
            nullable: true,
            description: 'Mark number that can be assigned manually',
          },
          actualWeight: {
            type: 'number',
            nullable: true,
            description: 'Weight in kilograms that can be manually updated',
          },
          pieces: {
            type: 'number',
            nullable: true,
            description: 'Pieces count that can be manually updated',
          },
          onTrain: {
            type: 'number',
            description: 'Manual count of items reported while assigned to a train leg',
          },
          scaned: {
            type: 'number',
            description: 'Manual scanned count for the barcode (must be >= 0)',
          },
          trainName: {
            type: 'string',
            nullable: true,
            description:
              'Optional train identifier to associate with the barcode (empty string clears the selection)',
          },
          wagonName: {
            type: 'string',
            nullable: true,
            description:
              'Optional wagon identifier to associate with the barcode (the `wagon` key is also accepted)',
          },
        },
      },
      AdminPrismaCreateRequest: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Prisma sheet name (with or without the "prisma " prefix)',
          },
          totalCount: {
            type: 'number',
          },
          factScanned: {
            type: 'number',
          },
        },
        required: ['name'],
      },
      AdminPrismaUpdateRequest: {
        type: 'object',
        properties: {
          totalCount: {
            type: 'number',
          },
          factScanned: {
            type: 'number',
          },
        },
      },
      AdminTrainCreateRequest: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Train sheet name (with or without the "train " prefix)',
          },
          totalCount: {
            type: 'number',
          },
          factLoaded: {
            type: 'number',
          },
        },
        required: ['name'],
      },
      AdminTrainUpdateRequest: {
        type: 'object',
        properties: {
          totalCount: {
            type: 'number',
          },
          factLoaded: {
            type: 'number',
          },
        },
      },
      AdminDeleteResponse: {
        type: 'object',
        properties: {
          deleted: {
            type: 'number',
          },
          name: {
            type: 'string',
          },
        },
      },
      AdminScanRecord: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
          },
          scanId: {
            type: 'string',
            nullable: true,
          },
          deviceId: {
            type: 'string',
          },
          deviceApp: {
            type: 'string',
          },
          labelType: {
            type: 'string',
          },
          friendlyName: {
            type: 'string',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
          },
          source: {
            type: 'string',
          },
          code: {
            type: 'string',
          },
          segments: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          total: {
            type: 'number',
          },
          comment: {
            type: 'string',
            nullable: true,
          },
          prismaName: {
            type: 'string',
            nullable: true,
          },
          trainName: {
            type: 'string',
            nullable: true,
          },
          wagonName: {
            type: 'string',
            nullable: true,
            description: 'Optional wagon identifier captured alongside the scan',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      AdminScanListResponse: {
        type: 'object',
        properties: {
          scans: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/AdminScanRecord',
            },
          },
          limit: {
            type: 'number',
            description: 'Actual number of scan rows included in this page',
          },
          page: {
            type: 'number',
            description: 'Page index returned (1-based)',
          },
          pageSize: {
            type: 'number',
            description: 'Number of rows requested per page (after clamping to 1-500)',
          },
        },
      },
      AdminScanCreateRequest: {
        type: 'object',
        properties: {
          scanId: {
            type: 'string',
            nullable: true,
          },
          deviceId: {
            type: 'string',
          },
          deviceApp: {
            type: 'string',
          },
          labelType: {
            type: 'string',
          },
          friendlyName: {
            type: 'string',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
          },
          source: {
            type: 'string',
          },
          code: {
            type: 'string',
          },
          segments: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          total: {
            type: 'number',
          },
          comment: {
            type: 'string',
            nullable: true,
          },
          prismaName: {
            type: 'string',
            nullable: true,
          },
          trainName: {
            type: 'string',
            nullable: true,
          },
          wagonName: {
            type: 'string',
            nullable: true,
          },
        },
        required: [
          'deviceId',
          'deviceApp',
          'labelType',
          'friendlyName',
          'timestamp',
          'source',
          'code',
          'segments',
          'total',
        ],
      },
      AdminScanUpdateRequest: {
        type: 'object',
        properties: {
          scanId: {
            type: 'string',
            nullable: true,
          },
          deviceId: {
            type: 'string',
          },
          deviceApp: {
            type: 'string',
          },
          labelType: {
            type: 'string',
          },
          friendlyName: {
            type: 'string',
          },
          timestamp: {
            type: 'string',
            format: 'date-time',
          },
          source: {
            type: 'string',
          },
          code: {
            type: 'string',
          },
          segments: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          total: {
            type: 'number',
          },
          comment: {
            type: 'string',
            nullable: true,
          },
          prismaName: {
            type: 'string',
            nullable: true,
          },
          trainName: {
            type: 'string',
            nullable: true,
          },
          wagonName: {
            type: 'string',
            nullable: true,
          },
        },
      },
      AdminScanBulkDeleteRequest: {
        type: 'object',
        properties: {
          ids: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
        },
        required: ['ids'],
      },
      AdminScanBulkDeleteResponse: {
        type: 'object',
        properties: {
          requested: {
            type: 'number',
          },
          deleted: {
            type: 'number',
          },
          missing: {
            type: 'number',
          },
        },
      },
      AdminScanExportRequest: {
        type: 'object',
        properties: {
          filters: {
            $ref: '#/components/schemas/AdminScanExportFilters',
          },
          sections: {
            $ref: '#/components/schemas/AdminScanExportSections',
          },
          detailLimit: {
            type: 'number',
            minimum: 1,
            maximum: 10000,
            description:
              'Rows limit for the scan details sheet (1-10000); ignored when `exportAllScans` is `true`.',
          },
          exportAllScans: {
            type: 'boolean',
            description:
              'Stream every matching scan to the details sheet by writing results into a temp file; ignores `detailLimit`.',
          },
          detailStreamChunkSize: {
            type: 'number',
            minimum: 100,
            maximum: 10000,
            description:
              'Chunk size used when streaming all scan details (controls how many rows are fetched per batch).',
          },
        },
      },
      AdminScanExportFilters: {
        type: 'object',
        properties: {
          prismaNames: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          trainNames: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          wagonNames: {
            type: 'array',
            items: {
              type: 'string',
            },
          },
          since: {
            type: 'string',
            format: 'date-time',
          },
          until: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      AdminScanExportSections: {
        type: 'object',
        properties: {
          overview: {
            type: 'boolean',
            description: 'Include the overview sheet with consolidated stats.',
          },
          prismaBreakdown: {
            type: 'boolean',
            description: 'Include the Prisma breakdown sheet.',
          },
          trainBreakdown: {
            type: 'boolean',
            description: 'Include the Train breakdown sheet.',
          },
          scanDetails: {
            type: 'boolean',
            description: 'Include the detail scan rows sheet.',
          },
          producentRecords: {
            type: 'boolean',
            description: 'Include the Producent table dump sheet.',
          },
        },
      },
    },
  },
};
