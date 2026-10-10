import { Router } from 'express';

import {
  getCompanySettingsController,
  updateCompanySettingsController,
  uploadCompanyLogoController,
} from '../controllers/company.controller';
import { requireModulePermission } from '../middlewares/auth.middleware';
import { uploadCompanyLogo } from '../middlewares/upload.middleware';

const companyRouter = Router();

companyRouter.get('/settings', requireModulePermission('empresa', 'read'), getCompanySettingsController);
companyRouter.put('/settings', requireModulePermission('empresa', 'update'), updateCompanySettingsController);
companyRouter.post(
  '/logo',
  requireModulePermission('empresa', 'update'),
  uploadCompanyLogo.single('file'),
  uploadCompanyLogoController,
);

export default companyRouter;
