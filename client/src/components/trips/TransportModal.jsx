// client/src/components/trips/TransportModal.jsx
import React from 'react';
import Modal from '../ui/Modal';
import ItemWizard from './ItemWizard';

/**
 * TransportModal - Modal wrapper for ItemWizard (transport type)
 * This provides the same step-based wizard experience on mobile as on desktop
 */
const TransportModal = ({
  isOpen,
  onClose,
  tripId,
  transportId = null,
  onSuccess,
  defaultDate = null
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" noPadding>
      <div className="h-[80vh] max-h-[700px]">
        <ItemWizard
          type="transport"
          itemId={transportId}
          tripId={tripId}
          defaultDate={defaultDate}
          onSuccess={onSuccess}
          onClose={onClose}
        />
      </div>
    </Modal>
  );
};

export default TransportModal;