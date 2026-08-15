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
  AUDIT_VIEW: "audit.view"
});

export const PERMISSION_TEMPLATES = Object.freeze({
  standard_director: Object.freeze({
    label: "Standard Director",
    permissions: Object.freeze([
      PERMISSIONS.DIRECTORS_VIEW,
      PERMISSIONS.MEETINGS_VIEW,
      PERMISSIONS.VOTES_CAST,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.DOCUMENTS_SUBMIT,
      PERMISSIONS.RESOLUTIONS_VIEW,
      PERMISSIONS.MINUTES_VIEW
    ])
  }),
  board_secretary: Object.freeze({
    label: "Board Secretary",
    permissions: Object.freeze([
      PERMISSIONS.DIRECTORS_VIEW,
      PERMISSIONS.MEETINGS_VIEW,
      PERMISSIONS.MEETINGS_CREATE,
      PERMISSIONS.MEETINGS_ATTENDANCE_MANAGE,
      PERMISSIONS.VOTES_CAST,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.DOCUMENTS_SUBMIT,
      PERMISSIONS.DOCUMENTS_REVIEW,
      PERMISSIONS.RESOLUTIONS_VIEW,
      PERMISSIONS.RESOLUTIONS_CREATE,
      PERMISSIONS.MINUTES_VIEW,
      PERMISSIONS.MINUTES_EDIT
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
      PERMISSIONS.VOTES_CAST,
      PERMISSIONS.VOTES_PUSH,
      PERMISSIONS.VOTES_CLOSE,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.DOCUMENTS_SUBMIT,
      PERMISSIONS.DOCUMENTS_REVIEW,
      PERMISSIONS.RESOLUTIONS_VIEW,
      PERMISSIONS.RESOLUTIONS_CREATE,
      PERMISSIONS.MINUTES_VIEW
    ])
  }),
  treasurer: Object.freeze({
    label: "Treasurer",
    permissions: Object.freeze([
      PERMISSIONS.DIRECTORS_VIEW,
      PERMISSIONS.MEETINGS_VIEW,
      PERMISSIONS.VOTES_CAST,
      PERMISSIONS.DOCUMENTS_VIEW,
      PERMISSIONS.DOCUMENTS_SUBMIT,
      PERMISSIONS.RESOLUTIONS_VIEW,
      PERMISSIONS.MINUTES_VIEW
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
