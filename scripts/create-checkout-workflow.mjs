// Script to create/update the Checkout Order workflow on n8n
// Usage: N8N_API_KEY=... CHECKOUT_TOKEN=... node scripts/create-checkout-workflow.mjs
const N8N_URL = 'https://n8n.mommamiacaters.com';
const N8N_API_KEY = process.env.N8N_API_KEY;
const CHECKOUT_TOKEN = process.env.CHECKOUT_TOKEN || 'mm-checkout-2026-change-me';

if (!N8N_API_KEY) {
  console.error('Error: N8N_API_KEY environment variable is required.');
  console.error('Usage: N8N_API_KEY=your-key node scripts/create-checkout-workflow.mjs');
  process.exit(1);
}

const n8nHeaders = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

// ============================================================
// Code node: Auth check + Format order data into email HTML
// ============================================================
const formatOrderCode = `
const webhookData = $('Checkout Webhook').first().json;
const headers = webhookData.headers || {};
const body = webhookData.body || webhookData;

// ─── Auth check ───
const expectedToken = '${CHECKOUT_TOKEN}';
const providedToken = headers['x-mm-auth-token'] || '';
if (providedToken !== expectedToken) {
  throw new Error('Unauthorized: invalid auth token');
}

const customer = body.customer || {};
const order = body.order || {};
const orderRef = body.orderRef || 'N/A';
const paymentProof = body.paymentProof || null;

const mealPlans = order.mealPlans || [];
const items = order.items || [];
const planInstances = order.planInstances || [];
const subtotal = order.subtotal || 0;

// ─── HTML escaping ───
function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const categoryLabels = { main: 'Main Dish', side: 'Side Dish', starch: 'Starch' };
const categoryOrder = ['main', 'side', 'starch'];

// Build per-plan-instance HTML cards
function buildPlanInstanceCards(instances) {
  if (!instances || instances.length === 0) return '';
  const sorted = [...instances].sort((a, b) => a.displayOrder - b.displayOrder);
  const typeCounters = {};
  const instanceNums = {};
  for (const pi of sorted) {
    typeCounters[pi.type] = (typeCounters[pi.type] || 0) + 1;
    instanceNums[pi.id] = typeCounters[pi.type];
  }
  return sorted.map(pi => {
    const num = instanceNums[pi.id];
    const itemsByCategory = {};
    for (const cat of categoryOrder) {
      const catItems = (pi.items || []).filter(i => i.type === cat);
      if (catItems.length > 0) itemsByCategory[cat] = catItems;
    }
    const categoryHtml = Object.entries(itemsByCategory).map(([cat, catItems]) =>
      '<div style="margin-bottom:8px">' +
      '<p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px">' + esc(categoryLabels[cat] || cat) + '</p>' +
      catItems.map(i => '<span style="display:inline-block;background:#F3E7D8;padding:4px 10px;border-radius:12px;font-size:13px;color:#333;margin:2px 4px 2px 0;text-transform:capitalize">' + esc(i.name) + '</span>').join('') +
      '</div>'
    ).join('');
    return '<div style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:12px">' +
      '<div style="background:#F3E7D8;padding:10px 14px;font-weight:bold;color:#333;font-size:14px">#' + num + ' ' + esc(pi.type) + '</div>' +
      '<div style="padding:12px 14px">' + (categoryHtml || '<p style="color:#aaa;font-size:13px;margin:0">No dishes selected</p>') + '</div>' +
    '</div>';
  }).join('');
}

// Build legacy flat rows (fallback)
const mealPlanRows = mealPlans.map(p =>
  '<tr><td style="padding:8px;border:1px solid #eee">' + esc(p.type) + '</td>' +
  '<td style="padding:8px;border:1px solid #eee;text-align:center">x' + esc(String(p.quantity)) + '</td></tr>'
).join('');

const itemRows = items.map(i =>
  '<tr><td style="padding:8px;border:1px solid #eee;text-transform:capitalize">' + esc(i.name) + '</td>' +
  '<td style="padding:8px;border:1px solid #eee;text-transform:capitalize">' + esc(i.type) + '</td></tr>'
).join('');

const hasPlanInstances = planInstances.length > 0;
const planCardsHtml = hasPlanInstances ? buildPlanInstanceCards(planInstances) : '';

const legacyOrderHtml = '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">' +
  '<tr style="background:#F3E7D8"><th style="padding:8px;text-align:left;border:1px solid #eee">Meal Plan</th><th style="padding:8px;text-align:center;border:1px solid #eee">Qty</th></tr>' +
  mealPlanRows + '</table>' +
  (items.length > 0 ? '<h4 style="color:#333;margin-bottom:8px">Selected Items</h4><table style="width:100%;border-collapse:collapse;margin-bottom:16px"><tr style="background:#F3E7D8"><th style="padding:8px;text-align:left;border:1px solid #eee">Item</th><th style="padding:8px;text-align:left;border:1px solid #eee">Type</th></tr>' + itemRows + '</table>' : '');

const orderDetailsHtml = hasPlanInstances ? planCardsHtml : legacyOrderHtml;

// ─── GCash receipt → real email attachment ───
// The frontend sends a data URI ("data:image/png;base64,XXXX"). n8n binary
// data wants the raw base64 (no prefix) plus mimeType + fileName, so we split
// the prefix off here and expose it as a binary property the email nodes attach.
let receiptBinary = null;
if (paymentProof && paymentProof.base64) {
  const [meta, rawB64] = String(paymentProof.base64).split(',');
  const mimeType = (meta.match(/data:(.*?);base64/) || [])[1] || paymentProof.mimeType || 'image/png';
  const ext = (mimeType.split('/')[1] || 'png').replace('jpeg', 'jpg');
  receiptBinary = {
    receipt: {
      data: rawB64 || '',
      mimeType,
      fileName: paymentProof.fileName || ('payment-receipt-' + orderRef + '.' + ext),
    },
  };
}

// Short note shown in the business email body; the actual image rides along as
// a downloadable attachment (inline base64 <img> is unreliable — Gmail strips it).
const paymentProofHtml = paymentProof
  ? '<h3 style="color:#E36A2E;border-bottom:2px solid #F3E7D8;padding-bottom:8px;margin-top:20px">Payment Receipt</h3>' +
    '<p style="color:#555;font-size:13px;margin:0">File <strong>' + esc(paymentProof.fileName) + '</strong> is attached to this email.</p>'
  : '<h3 style="color:#c0392b;border-bottom:2px solid #F3E7D8;padding-bottom:8px;margin-top:20px">⚠ No payment receipt attached</h3>';

const paymentStatusText = paymentProof ? 'Payment receipt received' : 'No payment receipt';

// ─── Customer Confirmation Email ───
const customerHtml = \`
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#E36A2E,#F2B34A);padding:30px;text-align:center;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;margin:0;font-size:24px">Order Confirmed!</h1>
    <p style="color:#fff;opacity:0.9;margin:8px 0 0">Reference: \${esc(orderRef)}</p>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none">
    <p style="color:#333;font-size:15px">Hi \${esc(customer.firstName)},</p>
    <p style="color:#555;font-size:14px;line-height:1.6">Thank you for your order with Momma Mia Catering! We've received your order and your payment receipt (attached to this email for your records). Our team will verify your payment and confirm the details shortly.</p>

    <h3 style="color:#E36A2E;border-bottom:2px solid #F3E7D8;padding-bottom:8px">Order Details</h3>
    \${orderDetailsHtml}

    <div style="background:#F3E7D8;padding:16px;border-radius:8px;text-align:right;margin-bottom:16px">
      <span style="font-size:14px;color:#555">Subtotal: </span>
      <span style="font-size:20px;font-weight:bold;color:#E36A2E">₱\${subtotal}</span>
    </div>

    <div style="background:#e8f5e9;padding:12px 16px;border-radius:8px;margin-bottom:16px">
      <p style="color:#2e7d32;font-size:14px;margin:0;font-weight:bold">✓ \${paymentStatusText}</p>
    </div>

    <h3 style="color:#E36A2E;border-bottom:2px solid #F3E7D8;padding-bottom:8px">Delivery Info</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 8px;color:#888;width:120px">Date</td><td style="padding:6px 8px;color:#333">\${esc(customer.deliveryDate) || 'TBD'}</td></tr>
      <tr><td style="padding:6px 8px;color:#888">Time</td><td style="padding:6px 8px;color:#333">\${esc(customer.deliveryTime) || 'TBD'}</td></tr>
      <tr><td style="padding:6px 8px;color:#888">Address</td><td style="padding:6px 8px;color:#333">\${esc(customer.deliveryAddress) || 'TBD'}</td></tr>
      \${customer.specialRequests ? '<tr><td style="padding:6px 8px;color:#888">Notes</td><td style="padding:6px 8px;color:#333">' + esc(customer.specialRequests) + '</td></tr>' : ''}
    </table>
  </div>
  <div style="background:#f9f9f9;padding:16px;text-align:center;border-radius:0 0 12px 12px;border:1px solid #eee;border-top:none">
    <p style="color:#888;font-size:12px;margin:0">Questions? Reply to this email or message us on Facebook.</p>
    <p style="color:#aaa;font-size:11px;margin:8px 0 0">Momma Mia Catering · mommamiacaters.com</p>
  </div>
</div>\`;

// ─── Business Notification Email ───
const businessHtml = \`
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:#E36A2E;padding:20px;border-radius:12px 12px 0 0">
    <h2 style="color:#fff;margin:0">New Order Received</h2>
    <p style="color:#fff;opacity:0.9;margin:4px 0 0">Ref: \${esc(orderRef)}</p>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none">
    <h3 style="color:#333;margin-top:0">Customer Info</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8;width:140px">Name</td><td style="padding:8px;border:1px solid #eee">\${esc(customer.firstName)} \${esc(customer.lastName)}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8">Email</td><td style="padding:8px;border:1px solid #eee"><a href="mailto:\${esc(customer.email)}">\${esc(customer.email)}</a></td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8">Phone</td><td style="padding:8px;border:1px solid #eee"><a href="tel:\${esc(customer.phone)}">\${esc(customer.phone)}</a></td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8">Delivery Date</td><td style="padding:8px;border:1px solid #eee">\${esc(customer.deliveryDate) || 'TBD'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8">Delivery Time</td><td style="padding:8px;border:1px solid #eee">\${esc(customer.deliveryTime) || 'TBD'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8">Address</td><td style="padding:8px;border:1px solid #eee">\${esc(customer.deliveryAddress)}</td></tr>
      \${customer.specialRequests ? '<tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8">Special Requests</td><td style="padding:8px;border:1px solid #eee">' + esc(customer.specialRequests) + '</td></tr>' : ''}
    </table>

    <h3 style="color:#333">Order Summary</h3>
    \${orderDetailsHtml}

    <div style="background:#E36A2E;color:#fff;padding:16px;border-radius:8px;text-align:center;font-size:20px;font-weight:bold;margin-bottom:20px">
      Subtotal: ₱\${subtotal}
    </div>

    \${paymentProofHtml}
  </div>
  <div style="padding:12px;text-align:center;color:#aaa;font-size:11px">
    Submitted at \${new Date().toISOString()} via mommamiacaters.com checkout
  </div>
</div>\`;

return [{
  json: {
    customerEmail: customer.email,
    customerName: esc(customer.firstName) + ' ' + esc(customer.lastName),
    customerHtml,
    businessHtml,
    orderRef,
    subtotal,
    hasReceipt: !!paymentProof,
    // For Google Sheets logging
    sheetTimestamp: new Date().toISOString(),
    sheetName: esc(customer.firstName) + ' ' + esc(customer.lastName),
    sheetEmail: customer.email || '',
    sheetPhone: customer.phone || '',
    sheetPaymentStatus: paymentProof ? 'Receipt Attached' : 'No Receipt'
  },
  // Binary travels with the item so the email nodes can attach it.
  binary: receiptBinary || {}
}];
`;

// ============================================================
// Build the checkout workflow
// ============================================================
const workflow = {
  name: "Momma Mia Checkout",
  nodes: [
    // --- Webhook Trigger ---
    {
      parameters: {
        httpMethod: "POST",
        path: "checkout",
        responseMode: "responseNode",
        options: {}
      },
      id: "checkout-webhook-001",
      name: "Checkout Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 1,
      position: [-200, 0],
      webhookId: "checkout-webhook-prod-001"
    },

    // --- Format Order Data (Code node — includes auth check) ---
    {
      parameters: {
        jsCode: formatOrderCode
      },
      id: "checkout-format-001",
      name: "Format Order Data",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [100, 0]
    },

    // --- Log to Google Sheets ---
    {
      parameters: {
        operation: "append",
        authentication: "serviceAccount",
        documentId: { __rl: true, value: "10DaGcvlPK5GpTcJD4rmCGPsMuCmrpd7-MppFBgAW8RM", mode: "id" },
        sheetName: { __rl: true, value: "ORDERS", mode: "name" },
        columns: {
          mappingMode: "defineBelow",
          value: {
            "Timestamp": "={{ $json.sheetTimestamp }}",
            "OrderRef": "={{ $json.orderRef }}",
            "Name": "={{ $json.sheetName }}",
            "Email": "={{ $json.sheetEmail }}",
            "Phone": "={{ $json.sheetPhone }}",
            "Subtotal": "={{ $json.subtotal }}",
            "PaymentStatus": "={{ $json.sheetPaymentStatus }}"
          },
          matchingColumns: [],
          schema: [
            { id: "Timestamp", displayName: "Timestamp", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
            { id: "OrderRef", displayName: "OrderRef", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
            { id: "Name", displayName: "Name", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
            { id: "Email", displayName: "Email", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
            { id: "Phone", displayName: "Phone", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
            { id: "Subtotal", displayName: "Subtotal", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true },
            { id: "PaymentStatus", displayName: "PaymentStatus", required: false, defaultMatch: false, display: true, type: "string", canBeUsedToMatch: true }
          ]
        },
        options: {}
      },
      id: "checkout-sheets-001",
      name: "Log to Google Sheets",
      type: "n8n-nodes-base.googleSheets",
      typeVersion: 4,
      position: [350, 0],
      credentials: { googleApi: { id: "nkZu4D4KZUEbwpTZ", name: "Google Sheets account" } },
      continueOnFail: true
    },

    // --- Send Customer Confirmation Email ---
    {
      parameters: {
        fromEmail: "mommamiacaters@gmail.com",
        toEmail: "={{ $('Format Order Data').first().json.customerEmail }}",
        subject: "=Order Confirmed — {{ $('Format Order Data').first().json.orderRef }} | Momma Mia Catering",
        emailFormat: "html",
        html: "={{ $('Format Order Data').first().json.customerHtml }}",
        options: {
          replyTo: "mommamiacaters@gmail.com",
          // Attach the GCash receipt binary that rode along from the Code node.
          attachments: "receipt"
        }
      },
      id: "checkout-email-customer-001",
      name: "Email Customer",
      type: "n8n-nodes-base.emailSend",
      typeVersion: 2,
      position: [600, -100],
      credentials: {
        smtp: {
          id: "contact-smtp-1",
          name: "Gmail SMTP - Contact Form"
        }
      },
      continueOnFail: true
    },

    // --- Send Business Notification Email ---
    {
      parameters: {
        fromEmail: "mommamiacaters@gmail.com",
        toEmail: "mommamiacaters@gmail.com",
        subject: "=New Order — {{ $('Format Order Data').first().json.orderRef }} (₱{{ $('Format Order Data').first().json.subtotal }})",
        emailFormat: "html",
        html: "={{ $('Format Order Data').first().json.businessHtml }}",
        options: {
          replyTo: "={{ $('Format Order Data').first().json.customerEmail }}",
          // Attach the GCash receipt binary that rode along from the Code node.
          attachments: "receipt"
        }
      },
      id: "checkout-email-business-001",
      name: "Email Business",
      type: "n8n-nodes-base.emailSend",
      typeVersion: 2,
      position: [600, 100],
      credentials: {
        smtp: {
          id: "contact-smtp-1",
          name: "Gmail SMTP - Contact Form"
        }
      },
      continueOnFail: true
    },

    // --- Respond to Webhook ---
    {
      parameters: {
        respondWith: "json",
        responseBody: "={{ JSON.stringify({ success: true, orderRef: $('Format Order Data').first().json.orderRef, message: 'Order received' }) }}",
        options: {}
      },
      id: "checkout-response-001",
      name: "Webhook Response",
      type: "n8n-nodes-base.respondToWebhook",
      typeVersion: 1,
      position: [900, 0]
    }
  ],

  connections: {
    "Checkout Webhook": {
      main: [[{ node: "Format Order Data", type: "main", index: 0 }]]
    },
    // Branch straight off the Code node so the email nodes inherit its `receipt`
    // binary. (The Google Sheets node does not reliably forward binary data, so
    // routing emails through it would drop the attachment.)
    "Format Order Data": {
      main: [[
        { node: "Email Customer", type: "main", index: 0 },
        { node: "Email Business", type: "main", index: 0 },
        { node: "Log to Google Sheets", type: "main", index: 0 }
      ]]
    },
    "Email Customer": {
      main: [[{ node: "Webhook Response", type: "main", index: 0 }]]
    },
    "Email Business": {
      main: [[]]
    },
    "Log to Google Sheets": {
      main: [[]]
    }
  },

  settings: {
    executionOrder: "v1",
    saveDataSuccessExecution: "none"
  }
};

// ============================================================
// Deploy to n8n
// ============================================================
async function deploy() {
  console.log('Checking for existing checkout workflow...');
  const listRes = await fetch(`${N8N_URL}/api/v1/workflows`, { headers: n8nHeaders });

  if (!listRes.ok) {
    console.error('Failed to list workflows:', listRes.status, await listRes.text());
    process.exit(1);
  }

  const allWorkflows = await listRes.json();
  const existing = (allWorkflows.data || allWorkflows).find(w => w.name === 'Momma Mia Checkout');

  let workflowId;

  if (existing) {
    workflowId = existing.id;
    console.log(`Found existing workflow: ${workflowId}. Updating...`);

    const updateRes = await fetch(`${N8N_URL}/api/v1/workflows/${workflowId}`, {
      method: 'PUT',
      headers: n8nHeaders,
      body: JSON.stringify(workflow)
    });

    const updateData = await updateRes.json();
    if (!updateRes.ok) {
      console.error('Failed to update workflow:', updateRes.status, JSON.stringify(updateData, null, 2));
      process.exit(1);
    }
    console.log('Workflow updated!');
  } else {
    console.log('Creating new checkout workflow...');

    const createRes = await fetch(`${N8N_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: n8nHeaders,
      body: JSON.stringify(workflow)
    });

    const createData = await createRes.json();
    if (!createRes.ok) {
      console.error('Failed to create workflow:', createRes.status, JSON.stringify(createData, null, 2));
      process.exit(1);
    }

    workflowId = createData.id;
    console.log(`Workflow created with ID: ${workflowId}`);
  }

  // Activate
  console.log('Activating workflow...');
  const activateRes = await fetch(`${N8N_URL}/api/v1/workflows/${workflowId}/activate`, {
    method: 'POST',
    headers: n8nHeaders
  });

  if (activateRes.ok) {
    console.log('Workflow activated!');
  } else {
    console.error('Activation failed:', activateRes.status, await activateRes.text());
  }

  console.log('\nCheckout workflow is LIVE at:');
  console.log(`  ${N8N_URL}/webhook/checkout`);
  console.log('\nGoogle Sheets logging: ORDERS sheet');
  console.log('Auth token required: X-MM-Auth-Token header');
}

deploy().catch(console.error);
