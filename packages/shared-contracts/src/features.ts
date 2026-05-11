import type { FeatureManifest } from './index.js';

export const defaultBusinessFeature = {
  domain: 'default',
  name: 'Default Business',
  description: 'Single-business starter feature.',
  taskTypes: ['generic_task'],
  providerCapabilities: ['generic_execution'],
  webRoutes: [
    {
      path: '/workspace',
      label: 'Workspace',
      entry: 'features/default-business/WorkspaceView',
    },
  ],
  adminMenus: [
    {
      path: '/admin/tasks',
      label: 'Tasks',
      entry: 'features/default-business/AdminTasksView',
      requiredRoles: ['admin', 'super_admin'],
    },
  ],
} satisfies FeatureManifest;

export const aigcGenerationFeature = {
  domain: 'aigc_generation',
  name: 'AIGC Generation',
  description: 'Image and video generation workflows.',
  taskTypes: ['text_to_image', 'image_to_image', 'image_upscale', 'video_generation'],
  providerCapabilities: ['image_generation', 'image_processing', 'video_generation'],
  webRoutes: [
    {
      path: '/projects/:projectId/generation',
      label: 'Generation',
      entry: 'features/aigc-generation/GenerationWorkspace',
    },
  ],
  adminMenus: [
    {
      path: '/admin/generation/tasks',
      label: 'Generation Tasks',
      entry: 'features/aigc-generation/AdminGenerationTasks',
      requiredRoles: ['admin', 'super_admin'],
    },
  ],
} satisfies FeatureManifest;

export const novelAnalysisFeature = {
  domain: 'novel_analysis',
  name: 'Novel Analysis',
  description: 'Novel profile, character, and relationship analysis.',
  taskTypes: ['novel_profile_analysis'],
  providerCapabilities: ['document_parsing', 'text_analysis', 'relationship_extraction'],
  webRoutes: [
    {
      path: '/projects/:projectId/novels',
      label: 'Novel Analysis',
      entry: 'features/novel-analysis/NovelWorkspace',
    },
  ],
  adminMenus: [
    {
      path: '/admin/novels',
      label: 'Novel Projects',
      entry: 'features/novel-analysis/AdminNovelProjects',
      requiredRoles: ['admin', 'super_admin'],
    },
  ],
} satisfies FeatureManifest;

export const documentAnalysisFeature = {
  domain: 'document_analysis',
  name: 'Document Analysis',
  description: 'Document summary and risk analysis workflows.',
  taskTypes: ['document_summary', 'document_risk_analysis'],
  providerCapabilities: ['document_parsing', 'text_analysis'],
  webRoutes: [
    {
      path: '/projects/:projectId/documents',
      label: 'Document Analysis',
      entry: 'features/document-analysis/DocumentWorkspace',
    },
  ],
  adminMenus: [
    {
      path: '/admin/documents',
      label: 'Documents',
      entry: 'features/document-analysis/AdminDocuments',
      requiredRoles: ['admin', 'super_admin'],
    },
  ],
} satisfies FeatureManifest;

export const exampleFeatureManifests = [
  defaultBusinessFeature,
  aigcGenerationFeature,
  novelAnalysisFeature,
  documentAnalysisFeature,
] as const;
