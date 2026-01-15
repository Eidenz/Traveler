// client/src/components/trips/ActivityModal.jsx
import React from 'react';
import Modal from '../ui/Modal';
import ItemWizard from './ItemWizard';

/**
 * ActivityModal - Modal wrapper for ItemWizard (activity type)
 * This provides the same step-based wizard experience on mobile as on desktop
 */
const ActivityModal = ({
  isOpen,
  onClose,
  tripId,
  activityId = null,
  onSuccess,
  onDelete,
  defaultDate = null
}) => {
  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg" noPadding>
      <div className="h-[80vh] max-h-[700px]">
        <ItemWizard
          type="activity"
          itemId={activityId}
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

export default ActivityModal;