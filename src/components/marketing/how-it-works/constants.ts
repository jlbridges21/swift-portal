export const HOW_IT_WORKS_STAGES = [
  {
    key: "request",
    title: "Request",
    lead: "Client sends the project details.",
    body: "New work comes into ShootPortal with the client and project information already connected.",
    panelTitle: "New request",
    panelHint: "214 Oak Street · Avery Chen",
  },
  {
    key: "estimate",
    title: "Estimate",
    lead: "Send pricing without starting another email thread.",
    body: "Create and send the estimate from the project so pricing, approval, and client details stay together.",
    panelTitle: "Estimate sent",
    panelHint: "Listing Media Package · $450",
  },
  {
    key: "approval",
    title: "Approval",
    lead: "Know when the client is ready to move forward.",
    body: "Once they approve, the job moves forward without you having to chase down a yes.",
    panelTitle: "Approved",
    panelHint: "Avery approved the estimate",
  },
  {
    key: "schedule",
    title: "Schedule",
    lead: "Put the shoot on the calendar.",
    body: "Confirm the shoot time and keep the appointment connected to the project.",
    panelTitle: "Scheduled",
    panelHint: "Sat · 10:00 AM · 214 Oak Street",
  },
  {
    key: "shoot",
    title: "Shoot",
    lead: "Do the part you actually get paid for.",
    body: "Open the project and see the address, client, services, notes, and everything else you need.",
    panelTitle: "Shoot complete",
    panelHint: "Photos and video uploaded",
  },
  {
    key: "review",
    title: "Review",
    lead: "Keep feedback attached to the work.",
    body: "Clients can review media and send feedback without creating another messy chain of texts and emails.",
    panelTitle: "In review",
    panelHint: "Client notes on photo 3",
  },
  {
    key: "pay",
    title: "Pay",
    lead: "Send the invoice and collect payment.",
    body: "Payment status stays connected to the project so you know exactly what has been paid and what has not.",
    panelTitle: "Paid",
    panelHint: "Invoice · $450 received",
  },
  {
    key: "deliver",
    title: "Deliver",
    lead: "Finish the job professionally.",
    body: "Deliver the final media through the client portal instead of sending another random download link.",
    panelTitle: "Delivered",
    panelHint: "Finals ready in the portal",
  },
] as const;

export const HERO_PROJECT_STAGES = [
  "New Request",
  "Estimate Sent",
  "Approved",
  "Scheduled",
  "Shoot Complete",
  "Review",
  "Paid",
  "Delivered",
] as const;

export const BEFORE_TOOLS = [
  "Text messages",
  "Email threads",
  "Google Calendar",
  "Dropbox or Drive",
  "Separate invoices",
  "Payment links",
  "Notes and spreadsheets",
] as const;

export const AFTER_ITEMS = [
  "One client",
  "One project",
  "One schedule",
  "One conversation",
  "One media delivery",
  "One invoice",
  "One payment record",
] as const;

export const OUTCOME_CARDS = [
  {
    title: "Know where every job stands.",
    body: "See what is new, approved, scheduled, ready to deliver, or still waiting on payment.",
  },
  {
    title: "Stop losing details.",
    body: "Messages, files, appointments, approvals, and invoices stay connected to the project.",
  },
  {
    title: "Give clients a better experience.",
    body: "Clients know where to go instead of waiting for another email, text, or file link.",
  },
  {
    title: "Make growth less chaotic.",
    body: "A repeatable workflow makes it easier to handle more clients without creating more administrative mess.",
  },
] as const;
