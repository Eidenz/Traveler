// client/src/components/trips/LodgingModal.jsx
import React from 'react';
import Modal from '../ui/Modal';
import ItemWizard from './ItemWizard';

/**
 * LodgingModal - Modal wrapper for ItemWizard (lodging type)
 * This provides the same step-based wizard experience on mobile as on desktop
 */
const LodgingModal = ({
  isOpen,
  onClose,
  tripId,
  lodgingId = null,
  onSuccess,
  onDelete,
  defaultDate = null
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" noPadding>
      <div className="h-[80vh] max-h-[700px]">
        <ItemWizard
          type="lodging"
          itemId={lodgingId}
          tripId={tripId}
          defaultDate={defaultDate}
          onSuccess={onSuccess}
          onDelete={onDelete}
          onClose={onClose}
        />
      </div>
    </Modal>
  );
};

export default LodgingModal;