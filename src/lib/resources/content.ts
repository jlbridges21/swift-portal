import type { ResourceId } from "@/lib/resources/registry";

/**
 * Landing-page copy for each template: what's inside, how to use it, practical tips, FAQ.
 * Plain strings (also used for FAQPage JSON-LD). Practical guidance only: no invented
 * statistics, prices, or legal requirements.
 */
export type ResourceContent = {
  h1: string;
  intro: string;
  inside: { title: string; body: string }[];
  steps: string[];
  tips: { title: string; body: string }[];
  faq: { q: string; a: string }[];
  /** How ShootPortal relates, phrased around verified features. */
  productBridge: { title: string; body: string };
};

export const RESOURCE_CONTENT: Record<ResourceId, ResourceContent> = {
  "real-estate-photography-pricing-sheet": {
    h1: "Real estate photography pricing sheet template",
    intro:
      "An editable price sheet for real estate photographers: packages by square footage, an add-on menu, travel fee rules, and a built-in calculator that shows your cost and margin for every package. Fill it in, then print the client-facing menu for agents.",
    inside: [
      { title: "Package tiers by home size", body: "Three or more packages by square-footage band, each with photo count and what's included, ready for your prices." },
      { title: "Add-on menu", body: "Rows for drone, video, twilight, floor plans, 360° tours, and rush delivery, so agents can see extras at a glance." },
      { title: "Travel fee rules", body: "A place to set your free radius and how you charge beyond it, so every quote handles distance the same way." },
      { title: "Cost and margin calculator", body: "Enter your hours, rate, and costs, and the sheet calculates cost and a suggested price from your target margin." },
      { title: "Printable client menu (PDF)", body: "A clean price menu layout you can send to agents or attach to your website." },
    ],
    steps: [
      "Download the spreadsheet and open it in Excel, Google Sheets, or Numbers.",
      "In the cost calculator tab, enter your time on site, editing time, travel, hourly rate, and target margin.",
      "Use the suggested prices to fill in your package and add-on tiers on the price sheet tab.",
      "Set your travel fee rule and any notes agents need to know, such as turnaround time.",
      "Send agents the printable menu, and keep the spreadsheet as your master price list.",
    ],
    tips: [
      { title: "Price by size, not by hours", body: "Agents want a number before they book. Size bands keep it simple while protecting your time on large homes." },
      { title: "Make add-ons pay for themselves", body: "Video and twilight add far more editing than shooting time. Price them from their full time, not just the minutes on site." },
      { title: "Review prices on a schedule", body: "Revisit your sheet when costs change or your calendar fills, rather than adjusting one quote at a time." },
    ],
    faq: [
      { q: "Does the template include recommended prices?", a: "No. Prices are blank or marked as examples, because the right price depends on your costs and your market. Use the built-in calculator or the free real estate photography pricing calculator to set them." },
      { q: "Can I use it in Google Sheets?", a: "Yes. Upload the .xlsx file to Google Drive and open it with Google Sheets. The formulas carry over." },
      { q: "What's the difference between margin and markup in the calculator?", a: "Margin is profit as a share of the price; markup is profit as a share of cost. The calculator uses margin, so a 30% margin means you keep 30% of what the client pays." },
    ],
    productBridge: {
      title: "Turn your price sheet into a menu agents order from",
      body: "In ShootPortal, your packages become a service catalog on your branded request form. Agents pick a service, get an automatic preliminary estimate with your travel fee, and the request lands as a project you can schedule, bill, and deliver.",
    },
  },
  "drone-photography-quote": {
    h1: "Drone photography quote template",
    intro:
      "Fill in your drone quote right on this page: add your logo, your business and client details, and your prices, and watch the quote update as you type. Then download a polished PDF to send. Prefer to work offline? A Word version is below.",
    inside: [
      { title: "Business and client details", body: "Your logo area, contact information, and the client's details in a clean header." },
      { title: "Project and location", body: "Job address, date, and a notes field for airspace, access, and site contacts." },
      { title: "Line items and totals", body: "Quantity, rate, and amount columns with subtotal, discount, tax, total, and deposit rows." },
      { title: "Deliverables and timeline", body: "What the client receives and when, so expectations are set before the flight." },
      { title: "Weather and reschedule terms", body: "A prompt for how you handle unsafe conditions and rescheduling." },
      { title: "Acceptance", body: "A signature and date line so a quote becomes an agreement." },
    ],
    steps: [
      "Add your logo and business details at the top of the form. They're saved on this device for next time.",
      "Enter the client, the job location, and the shoot date.",
      "Tap Drone aerials to fill in common services, then type your price next to each one.",
      "Set the deposit, and open More options if you want a discount, tax, or different terms.",
      "Click Download PDF and send the file to your client.",
    ],
    tips: [
      { title: "Separate planning from flying", body: "Listing flight planning and any authorizations as their own line shows the client the work behind a short flight." },
      { title: "Put weather in writing", body: "A clear reschedule policy avoids awkward conversations when conditions aren't safe to fly." },
      { title: "Check what applies where you fly", body: "Requirements differ by location and operation. The template is a starting point, not legal advice." },
    ],
    faq: [
      { q: "Is this template free to use commercially?", a: "Yes. Use it for your own business and edit anything you like." },
      { q: "Should I charge a deposit for drone work?", a: "Many pilots take a deposit to confirm the date. The template includes deposit and balance rows; set the amount to match your policy." },
      { q: "How do I work out the prices to put in?", a: "Use the free drone photography pricing calculator. It works out a price from your hours, hourly rate, and travel, and can make the quote for you too." },
      { q: "Is my information uploaded anywhere?", a: "No. Everything you type, including your logo, stays in your browser on this device. The PDF is created on your device too." },
    ],
    productBridge: {
      title: "Send quotes clients approve online",
      body: "In ShootPortal, proposals are built from your service catalog with travel fees, and clients approve or request changes in your branded portal. Approval can create the deposit payment link, and the same project carries scheduling, video review, and delivery.",
    },
  },
  "photography-invoice": {
    h1: "Photography invoice template",
    intro:
      "Make your invoice right on this page: add your logo and details, list what you're billing for, and the totals and balance due work themselves out as you type. Download a polished PDF in one click. Prefer a spreadsheet? The Excel version is below.",
    inside: [
      { title: "Invoice details", body: "Invoice number, invoice date, and due date fields." },
      { title: "Bill-to and project", body: "Client details and the project or property the invoice covers." },
      { title: "Line items with formulas", body: "Quantity times rate for every line, totals calculated for you." },
      { title: "Discount, tax, and deposit", body: "Optional discount and tax rate cells, plus deposit paid and balance due." },
      { title: "Payment instructions", body: "A block for how and where the client can pay." },
    ],
    steps: [
      "Add your logo and business details once. They're saved on this device for your next invoice.",
      "Enter who you're billing and the project.",
      "List each service with its price. Totals add up on their own.",
      "Enter any deposit already paid and how the client can pay you.",
      "Click Download PDF and send the file to your client.",
    ],
    tips: [
      { title: "Number invoices consistently", body: "A simple pattern, like the year plus a sequence, makes payments easy to match later." },
      { title: "Show the deposit you've received", body: "Clients pay faster when the remaining balance is unmistakable." },
      { title: "Tax depends on where you work", body: "Whether sales tax applies to photography varies by location. Leave the rate at zero unless it applies to you." },
    ],
    faq: [
      { q: "Is my information uploaded anywhere?", a: "No. Everything you type, including your logo, stays in your browser on this device, and the PDF is created on your device." },
      { q: "Does the spreadsheet version work in Google Sheets?", a: "Yes. Upload the .xlsx file to Google Drive and open it in Google Sheets; the formulas work there too." },
      { q: "Is this template tax or legal advice?", a: "No. It's a practical layout. Check your local requirements for tax and invoicing." },
      { q: "What should my payment terms be?", a: "Choose terms that match how you work, such as a deposit to book and the balance before final files. State them on the quote and repeat them on the invoice." },
    ],
    productBridge: {
      title: "Get paid from the project, not a separate spreadsheet",
      body: "In ShootPortal, you request payment from the project and clients pay by card through Stripe Checkout, straight to your own Stripe account. Take a deposit on approval, request the balance later, record cash or checks, and let downloads wait until the project is delivered.",
    },
  },
  "real-estate-photography-shot-list": {
    h1: "Real estate photography shot list",
    intro:
      "A printable real estate photography shot list: a prep checklist to send the agent or homeowner before the shoot, then exterior, room-by-room interior, detail, twilight, and drone shots with a final on-site check. Tick it off as you go so you never leave a property missing a shot.",
    inside: [
      { title: "Pre-shoot prep for the agent", body: "Lights on, blinds open, counters cleared, cars moved, pets and people out of frame." },
      { title: "Exterior shots", body: "Front elevation angles, back of the house, yard, outdoor living, and street context." },
      { title: "Interior, room by room", body: "Kitchen, living areas, bedrooms, bathrooms, and other spaces with the angles listings usually need." },
      { title: "Details and features", body: "Finishes, fixtures, and features worth highlighting." },
      { title: "Twilight and drone add-ons", body: "Dusk exteriors and aerial views when they're part of the order." },
      { title: "Final on-site check", body: "A last pass before you leave so nothing needs a return trip." },
    ],
    steps: [
      "Send the prep checklist to the agent a day or two before the shoot.",
      "Print the shot list or open the editable version on your phone.",
      "Work through exteriors first if the light is right, then interiors room by room.",
      "Add any agent requests to the notes section before you start.",
      "Do the final check before you pack up.",
    ],
    tips: [
      { title: "Make the agent your partner", body: "A prepared home saves you time on site and in editing. Sending the prep list early is the easiest win." },
      { title: "Shoot in a consistent order", body: "Moving through the property the same way every time makes it much harder to miss a room." },
      { title: "Keep it editable", body: "Adjust the list for your packages, and keep separate versions for photo-only and photo-plus-video orders." },
    ],
    faq: [
      { q: "How many photos should a listing have?", a: "It depends on the property, the package the agent ordered, and local listing norms. The shot list is organized by space so you can match it to any package size." },
      { q: "Can I customize the shot list?", a: "Yes. Download the Word version and add or remove rooms, angles, or notes." },
      { q: "Is drone photography included?", a: "There's a section for aerial shots when they're part of the order. Check what applies to flying at each property." },
    ],
    productBridge: {
      title: "Keep the shoot details with the listing",
      body: "In ShootPortal, the agent's request (address, service, preferred date, and access notes) lands as a project with the shoot time, messages, and delivery on the same record, so shoot-day details aren't buried in a text thread.",
    },
  },
  "drone-photography-business-plan": {
    h1: "Drone photography business plan template",
    intro:
      "A guided business plan for commercial drone pilots. Each section has prompts that help you decide what you'll offer, who you'll serve, how you'll price, what it costs to run, and what you want the business to earn, in a document you can edit and share.",
    inside: [
      { title: "Executive summary", body: "A one-page snapshot of the business, written last." },
      { title: "Services", body: "The types of aerial work you'll offer and what's included." },
      { title: "Target customers and markets", body: "Prompts for real estate, construction, inspections, events, and other segments." },
      { title: "Pricing approach", body: "How you'll price jobs, packages, travel, and add-ons." },
      { title: "Equipment list", body: "A table for aircraft, batteries, cameras, and accessories." },
      { title: "Operations and compliance", body: "Prompts for certification, insurance, and safety procedures." },
      { title: "Marketing plan", body: "How customers will find you and why they'll choose you." },
      { title: "Costs and revenue goals", body: "Startup and monthly cost tables and a revenue goals worksheet." },
      { title: "Milestones", body: "What you want done in the first 30, 90, and 365 days." },
    ],
    steps: [
      "Download the document and work through the sections in order, skipping the executive summary.",
      "Fill in your equipment and cost tables with real numbers from quotes and receipts.",
      "Use your monthly costs and target income to set a revenue goal and a minimum job price.",
      "Write the executive summary last, once the rest is clear.",
      "Revisit the plan every few months as you learn which work is most profitable.",
    ],
    tips: [
      { title: "Pick a focus", body: "A clear primary market makes marketing, pricing, and equipment decisions much easier." },
      { title: "Count every recurring cost", body: "Insurance, software, and equipment replacement add up. They belong in every job's price." },
      { title: "Plan for weather", body: "Build reschedules into your calendar and terms from day one." },
    ],
    faq: [
      { q: "Do I need a business plan to start a drone business?", a: "Not always, but writing one forces the decisions that matter: who you serve, what you charge, and what it costs to operate." },
      { q: "Does the template cover FAA requirements?", a: "It includes prompts for certification, insurance, and safety, but it isn't legal advice. Check the requirements that apply to your operations and location." },
      { q: "How do I estimate my prices for the plan?", a: "Use the free drone photography pricing calculator with your planned costs and hours to see what each type of job needs to cost." },
    ],
    productBridge: {
      title: "Run the business side from day one",
      body: "ShootPortal handles the client side of drone work: request forms, estimates with travel fees, proposed flight times clients accept, video review, deposits and card payments, and delivery in a portal branded to your business.",
    },
  },
  "photography-client-questionnaire": {
    h1: "Photography client questionnaire",
    intro:
      "A client questionnaire to send before a shoot so you arrive knowing the goals, deliverables, usage, schedule, location access, style, budget, and who approves the work. It works for real estate, commercial, drone, and video projects.",
    inside: [
      { title: "Contact details", body: "Who you're working with and the best way to reach them." },
      { title: "Project goals", body: "What the photos or video need to achieve and where they'll be used." },
      { title: "Deliverables and usage", body: "Formats, quantities, and how the client plans to use the images." },
      { title: "Schedule and access", body: "Dates, time windows, keys or codes, parking, and on-site contacts." },
      { title: "Location details", body: "Address, rooms or areas to include, and anything to avoid." },
      { title: "Style references", body: "Links or examples the client likes." },
      { title: "Budget and approvals", body: "A budget range and who signs off on the final work." },
    ],
    steps: [
      "Download the editable version and add your business name.",
      "Remove any sections that don't apply to the type of work you do.",
      "Send it to new clients after the first conversation and before you quote.",
      "Use the answers to build an accurate quote and a shot list.",
      "Keep the completed questionnaire with the project for reference.",
    ],
    tips: [
      { title: "Ask about usage early", body: "Knowing where images will appear shapes deliverables, formats, and sometimes price." },
      { title: "Find the decision maker", body: "Knowing who approves the work prevents late surprises in review." },
      { title: "Keep it short for repeat clients", body: "Trim the questionnaire for clients you work with often." },
    ],
    faq: [
      { q: "When should I send a client questionnaire?", a: "After the first conversation and before you send a quote, so the quote reflects what the client actually needs." },
      { q: "Can clients fill it in digitally?", a: "Yes. Send the Word version to fill in, or share it as a Google Doc. A printable PDF is included too." },
      { q: "Does it work for video and drone projects?", a: "Yes. The deliverables, schedule, and location sections apply to video and aerial work as well." },
    ],
    productBridge: {
      title: "Collect project details as the request comes in",
      body: "ShootPortal's branded request form captures the client's contact details, address, chosen service, preferred date, and notes, and creates the project and client record automatically, with messages and files staying on that project.",
    },
  },
  "photography-project-workflow-checklist": {
    h1: "Photography project workflow checklist",
    intro:
      "A checklist for every stage of a photography job, from first inquiry through estimate, booking, shoot day, editing, review, payment, delivery, and follow-up, plus an editable spreadsheet tracker so you can see where every project stands.",
    inside: [
      { title: "Inquiry and estimate", body: "Respond, qualify, gather details, and send a clear estimate." },
      { title: "Booking and pre-shoot", body: "Confirm the date, take a deposit, and prepare the client and location." },
      { title: "Shoot day", body: "Gear, shot list, and on-site checks." },
      { title: "Editing and review", body: "Cull, edit, send for review, and handle revisions." },
      { title: "Payment and delivery", body: "Collect the balance, deliver final files, and confirm receipt." },
      { title: "Follow-up", body: "Thank the client and ask for feedback or referrals." },
      { title: "Project tracker spreadsheet", body: "One row per project with a status for each stage." },
    ],
    steps: [
      "Print the checklist, or keep it open while you set up your own process.",
      "Download the tracker spreadsheet and add one row per active project.",
      "Update each project's status as it moves through the stages.",
      "Review the tracker weekly to spot jobs waiting on you or on the client.",
      "Adjust the steps to match how your business works.",
    ],
    tips: [
      { title: "Write the process down once", body: "A written workflow is the first step to delegating, automating, or simply not forgetting." },
      { title: "Watch the handoffs", body: "Jobs stall between stages, like after the shoot or after delivery, so check those first." },
      { title: "Separate automatic from manual", body: "Know which steps a tool can handle and which need your judgment." },
    ],
    faq: [
      { q: "What are the stages of a photography workflow?", a: "Inquiry, estimate, booking, pre-shoot preparation, the shoot, editing, client review, payment, delivery, and follow-up. The checklist covers each one." },
      { q: "Can I edit the tracker?", a: "Yes. The spreadsheet opens in Excel, Google Sheets, and Numbers, and you can add columns or stages." },
      { q: "How is this different from workflow software?", a: "The checklist and tracker help you organize the work by hand. Workflow software connects the stages so information carries from one step to the next." },
    ],
    productBridge: {
      title: "Run every stage on one project",
      body: "ShootPortal follows the same workflow: request, estimate, schedule, shoot, review, pay, deliver. Some hand-offs run on their own, like creating the project from a request or moving it to Delivered when payment clears, and every step stays on one record.",
    },
  },
};
