/** Shared role constants for backend authorization and realtime rooms. */
const STAFF_ROLES = Object.freeze(["technical", "employee", "manager", "primary"]);
const SUPPORT_STAFF_ROLES = Object.freeze(["employee", "manager", "primary"]);
const DASHBOARD_ROLES = Object.freeze(["technical", "employee", "manager", "primary"]);
const CUSTOMER_ROLE = "customer";

module.exports = {
    STAFF_ROLES,
    SUPPORT_STAFF_ROLES,
    DASHBOARD_ROLES,
    CUSTOMER_ROLE,
};
