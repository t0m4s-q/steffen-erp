'use client';

import React from 'react';
import { NewRawMaterialModal } from './NewRawMaterialModal';
import type { SupplierOptionDTO } from '@/actions/master-item.dto';

interface NewComponentModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSuppliers: SupplierOptionDTO[];
  onSuccess?: () => void;
}

export const NewComponentModal: React.FC<NewComponentModalProps> = (props) => {
  return <NewRawMaterialModal {...props} initialType="COM" />;
};
