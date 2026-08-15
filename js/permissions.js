export const ROOT_PERMISSION = "*";

export const PERMISSIONS = Object.freeze({
  DIRECTORS_VIEW: "directors.view",
  DIRECTORS_CREATE: "directors.create",
  DIRECTORS_UPDATE: "directors.update",
  DIRECTORS_SUSPEND: "directors.suspend",
  PERMISSIONS_MANAGE: "permissions.manage",
  ANNOUNCEMENTS_MANAGE: "announcements.manage",
  MEETINGS_VIEW: "meetings.view",
  MEETINGS_CREATE: "meetings.create",
  MEETINGS_ACTIVATE: "meetings.activate",
  MEETINGS_CONTROL: "meetings.control",
  MEETINGS_ATTENDANCE_MANAGE: "meetings.attendance.manage",
  AGENDA_MANAGE: "agenda.manage",
  MOTIONS_CREATE: "motions.create",
  MOTIONS_SECOND: "motions.second",
  VOTES_VIEW: "votes.view",
  VOTES_CAST: "votes.cast",
  VOTES_PUSH: "votes.push",
  VOTES_CLOSE: "votes.close",
  DOCUMENTS_VIEW: "documents.view",
  DOCUMENTS_SUBMIT: "documents.submit",
  DOCUMENTS_REVIEW: "documents.review",
  RESOLUTIONS_VIEW: "resolutions.view",
  RESOLUTIONS_CREATE: "resolutions.create",
  MINUTES_VIEW: "minutes.view",
  MINUTES_EDIT: "minutes.edit",
  MINUTES_CERTIFY: "minutes.certify",
  RECORDS_VIEW: "records.view",
  RECORDS_CERTIFY: "records.certify",
  COMMITTEES_VIEW: "committees.view",
  COMMITTEES_MANAGE: "committees.manage",
  COI_VIEW: "coi.view",
  COI_SUBMIT: "coi.submit",
  COI_REVIEW: "coi.review",
  COI_MANAGE: "coi.manage",
  OFFICERS_VIEW: "officers.view",
  OFFICERS_MANAGE: "officers.manage",
  TASKS_VIEW: "tasks.view",
  TASKS_CREATE: "tasks.create",
  TASKS_UPDATE_OWN: "tasks.updateOwn",
  TASKS_MANAGE: "tasks.manage",
  COMPLIANCE_VIEW: "compliance.view",
  COMPLIANCE_MANAGE: "compliance.manage",
  AUDIT_VIEW: "audit.view"
});

const STANDARD_GOVERNANCE_ACCESS = Object.freeze([
  PERMISSIONS.COMMITTEES_VIEW,
  PERMISSIONS.COI_VIEW,
  PERMISSIONS.COI_SUBMIT,
  PERMISSIONS.OFFICERS_VIEW,
  PERMISSIONS.TASKS_VIEW,
  PERMISSIONS.TASKS_UPDATE_OWN,
  PERMISSIONS.COMPLIANCE_VIEW
]);

export const PERMISSION_TEMPLATES = Object.freeze({
  standard_director: Object.freeze({
    label: "Standard Director",
    permissions: Object.freeze([
      PERMISSIONS.DIRECTORS_VIEW,
      PERMISSIONS.MEETINGS_VIEW,
      PERMISSIONS.MOTIONS_CREATE,
      PERMISSIONS.MOTIONS_SECOND,
      PERMISSIONS.VOTES_VIEW,
      PERMISSIONS.VOTES_CAST,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.DOCUMENTS_SUBMIT,
      PERMISSIONS.RESOLUTIONS_VIEW,
      PERMISSIONS.MINUTES_VIEW,
      PERMISSIONS.RECORDS_VIEW,
      ...STANDARD_GOVERNANCE_ACCESS
    ])
  }),
  board_secretary: Object.freeze({
    label: "Board Secretary",
    permissions: Object.freeze([
      PERMISSIONS.DIRECTORS_VIEW,
      PERMISSIONS.MEETINGS_VIEW,
      PERMISSIONS.MEETINGS_CREATE,
      PERMISSIONS.MEETINGS_ATTENDANCE_MANAGE,
      PERMISSIONS.AGENDA_MANAGE,
      PERMISSIONS.MOTIONS_CREATE,
      PERMISSIONS.MOTIONS_SECOND,
      PERMISSIONS.VOTES_VIEW,
      PERMISSIONS.VOTES_CAST,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.DOCUMENTS_SUBMIT,
      PERMISSIONS.DOCUMENTS_REVIEW,
      PERMISSIONS.RESOLUTIONS_VIEW,
      PERMISSIONS.RESOLUTIONS_CREATE,
      PERMISSIONS.MINUTES_VIEW,
      PERMISSIONS.MINUTES_EDIT,
      PERMISSIONS.MINUTES_CERTIFY,
      PERMISSIONS.RECORDS_VIEW,
      PERMISSIONS.RECORDS_CERTIFY,
      ...STANDARD_GOVERNANCE_ACCESS,
      PERMISSIONS.COMMITTEES_MANAGE,
      PERMISSIONS.COI_REVIEW,
      PERMISSIONS.TASKS_CREATE,
      PERMISSIONS.TASKS_MANAGE,
      PERMISSIONS.COMPLIANCE_MANAGE
    ])
  }),
  board_chair: Object.freeze({
    label: "Board Chair",
    permissions: Object.freeze([
      PERMISSIONS.DIRECTORS_VIEW,
      PERMISSIONS.ANNOUNCEMENTS_MANAGE,
      PERMISSIONS.MEETINGS_VIEW,
      PERMISSIONS.MEETINGS_CREATE,
      PERMISSIONS.MEETINGS_ACTIVATE,
      PERMISSIONS.MEETINGS_CONTROL,
      PERMISSIONS.MEETINGS_ATTENDANCE_MANAGE,
      PERMISSIONS.AGENDA_MANAGE,
      PERMISSIONS.MOTIONS_CREATE,
      PERMISSIONS.MOTIONS_SECOND,
      PERMISSIONS.VOTES_VIEW,
      PERMISSIONS.VOTES_CAST,
      PERMISSIONS.VOTES_PUSH,
      PERMISSIONS.VOTES_CLOSE,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.DOCUMENTS_SUBMIT,
      PERMISSIONS.DOCUMENTS_REVIEW,
      PERMISSIONS.RESOLUTIONS_VIEW,
      PERMISSIONS.RESOLUTIONS_CREATE,
      PERMISSIONS.MINUTES_VIEW,
      PERMISSIONS.RECORDS_VIEW,
      ...STANDARD_GOVERNANCE_ACCESS,
      PERMISSIONS.COMMITTEES_MANAGE,
      PERMISSIONS.COI_REVIEW,
      PERMISSIONS.TASKS_CREATE,
      PERMISSIONS.TASKS_MANAGE
    ])
  }),
  treasurer: Object.freeze({
    label: "Treasurer",
    permissions: Object.freeze([
      PERMISSIONS.DIRECTORS_VIEW,
      PERMISSIONS.MEETINGS_VIEW,
      PERMISSIONS.MOTIONS_CREATE,
      PERMISSIONS.MOTIONS_SECOND,
      PERMISSIONS.VOTES_VIEW,
      PERMISSIONS.VOTES_CAST,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.DOCUMENTS_SUBMIT,
      PERMISSIONS.RESOLUTIONS_VIEW,
      PERMISSIONS.MINUTES_VIEW,
      PERMISSIONS.RECORDS_VIEW,
      ...STANDARD_GOVERNANCE_ACCESS,
      PERMISSIONS.TASKS_CREATE,
      PERMISSIONS.COMPLIANCE_MANAGE
    ])
  })
});

export function hasPermission(profile, permission) {
  if (!profile) return false;
  if (profile.root === true && profile.systemRole === "founder_director") return true;
  const permissions = Array.isArray(profile.permissions) ? profile.permissions : [];
  return permissions.includes(ROOT_PERMISSION) || permissions.includes(permission);
}

export function permissionsForTemplate(templateKey) {
  const template = PERMISSION_TEMPLATES[templateKey];
  if (!template) return [...PERMISSION_TEMPLATES.standard_director.permissions];
  return [...template.permissions];
}
