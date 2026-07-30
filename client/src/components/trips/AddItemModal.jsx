// client/src/components/trips/AddItemModal.jsx
import React from 'react';
import Modal from '../ui/Modal';
import ItemWizard from './ItemWizard';

/**
 * AddItemModal - Modal wrapper for ItemWizard in create mode.
 * With type=null the wizard opens on its type-chooser panel; a preset type
 * (from a filtered timeline tab) skips straight to that flow.
 */
const AddItemModal = ({
  isOpen,
  onClose,
  tripId,
  type = null,
  defaultDate = null,
  tripStartDate,
  tripEndDate,
  members = [],
  onSuccess
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" noPadding>
      <div className="h-[80vh] max-h-[700px]">
        <ItemWizard
          type={type}
          tripId={tripId}
          defaultDate={defaultDate}
          onSuccess={onSuccess}
          onClose={onClose}
          tripStartDate={tripStartDate}
          tripEndDate={tripEndDate}
          members={members}
        />
      </div>
    </Modal>
  );
};

export default AddItemModal;
