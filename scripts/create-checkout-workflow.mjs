// Script to create the Checkout Order workflow on n8n
// Usage: node scripts/create-checkout-workflow.mjs
const N8N_URL = 'https://n8n.mommamiacaters.com';
const N8N_API_KEY = process.env.N8N_API_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhYTE2ZmM4My00ZDQ4LTRlYjgtYmI3Yi1iNzQ1ZTE1MmFhMjgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDY1NGI1MjktNDkyNy00NDkxLWI3M2QtYzNhMzU0MzQ5YzMwIiwiaWF0IjoxNzcxNzg3MDc0fQ.GRkWQZxsLaSG5DGd-1AOGD5LOQ40h_hHU_-L7tA-RHs';

const n8nHeaders = {
  'X-N8N-API-KEY': N8N_API_KEY,
  'Content-Type': 'application/json'
};

// ============================================================
// Code node: Format order data into email HTML
// ============================================================
const formatOrderCode = `
const webhookData = $('Checkout Webhook').first().json;
const body = webhookData.body || webhookData;

const customer = body.customer || {};
const order = body.order || {};
const orderRef = body.orderRef || 'N/A';

const mealPlans = order.mealPlans || [];
const items = order.items || [];
const planInstances = order.planInstances || [];
const subtotal = order.subtotal || 0;

const categoryLabels = { main: 'Main Dish', side: 'Side Dish', starch: 'Starch' };
const categoryOrder = ['main', 'side', 'starch'];

// Build per-plan-instance HTML cards
function buildPlanInstanceCards(instances) {
  if (!instances || instances.length === 0) return '';

  // Sort by displayOrder
  const sorted = [...instances].sort((a, b) => a.displayOrder - b.displayOrder);

  // Number instances per type
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
      '<p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin:0 0 4px">' + (categoryLabels[cat] || cat) + '</p>' +
      catItems.map(i => '<span style="display:inline-block;background:#F3E7D8;padding:4px 10px;border-radius:12px;font-size:13px;color:#333;margin:2px 4px 2px 0;text-transform:capitalize">' + i.name + '</span>').join('') +
      '</div>'
    ).join('');

    return '<div style="border:1px solid #eee;border-radius:8px;overflow:hidden;margin-bottom:12px">' +
      '<div style="background:#F3E7D8;padding:10px 14px;font-weight:bold;color:#333;font-size:14px">' + pi.type + ' #' + num + '</div>' +
      '<div style="padding:12px 14px">' + (categoryHtml || '<p style="color:#aaa;font-size:13px;margin:0">No dishes selected</p>') + '</div>' +
    '</div>';
  }).join('');
}

// Build legacy flat rows (fallback)
const mealPlanRows = mealPlans.map(p =>
  '<tr><td style="padding:8px;border:1px solid #eee">' + p.type + '</td>' +
  '<td style="padding:8px;border:1px solid #eee;text-align:center">x' + p.quantity + '</td></tr>'
).join('');

const itemRows = items.map(i =>
  '<tr><td style="padding:8px;border:1px solid #eee;text-transform:capitalize">' + i.name + '</td>' +
  '<td style="padding:8px;border:1px solid #eee;text-transform:capitalize">' + i.type + '</td></tr>'
).join('');

// Choose between grouped or flat view
const hasPlanInstances = planInstances.length > 0;
const planCardsHtml = hasPlanInstances ? buildPlanInstanceCards(planInstances) : '';

const legacyOrderHtml = '<table style="width:100%;border-collapse:collapse;margin-bottom:16px">' +
  '<tr style="background:#F3E7D8"><th style="padding:8px;text-align:left;border:1px solid #eee">Meal Plan</th><th style="padding:8px;text-align:center;border:1px solid #eee">Qty</th></tr>' +
  mealPlanRows + '</table>' +
  (items.length > 0 ? '<h4 style="color:#333;margin-bottom:8px">Selected Items</h4><table style="width:100%;border-collapse:collapse;margin-bottom:16px"><tr style="background:#F3E7D8"><th style="padding:8px;text-align:left;border:1px solid #eee">Item</th><th style="padding:8px;text-align:left;border:1px solid #eee">Type</th></tr>' + itemRows + '</table>' : '');

const orderDetailsHtml = hasPlanInstances ? planCardsHtml : legacyOrderHtml;

// ─── Customer Confirmation Email ───
const customerHtml = \`
<div style="font-family:sans-serif;max-width:600px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#E36A2E,#F2B34A);padding:30px;text-align:center;border-radius:12px 12px 0 0">
    <h1 style="color:#fff;margin:0;font-size:24px">Order Confirmed!</h1>
    <p style="color:#fff;opacity:0.9;margin:8px 0 0">Reference: \${orderRef}</p>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none">
    <p style="color:#333;font-size:15px">Hi \${customer.firstName},</p>
    <p style="color:#555;font-size:14px;line-height:1.6">Thank you for your order with Momma Mia Catering! We've received your order and our team will review it shortly. We'll reach out to confirm the details and arrange payment.</p>

    <h3 style="color:#E36A2E;border-bottom:2px solid #F3E7D8;padding-bottom:8px">Order Details</h3>
    \${orderDetailsHtml}

    <div style="background:#F3E7D8;padding:16px;border-radius:8px;text-align:right;margin-bottom:16px">
      <span style="font-size:14px;color:#555">Subtotal: </span>
      <span style="font-size:20px;font-weight:bold;color:#E36A2E">₱\${subtotal}</span>
    </div>

    <h3 style="color:#E36A2E;border-bottom:2px solid #F3E7D8;padding-bottom:8px">Delivery Info</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr><td style="padding:6px 8px;color:#888;width:120px">Date</td><td style="padding:6px 8px;color:#333">\${customer.deliveryDate || 'TBD'}</td></tr>
      <tr><td style="padding:6px 8px;color:#888">Time</td><td style="padding:6px 8px;color:#333">\${customer.deliveryTime || 'TBD'}</td></tr>
      <tr><td style="padding:6px 8px;color:#888">Address</td><td style="padding:6px 8px;color:#333">\${customer.deliveryAddress || 'TBD'}</td></tr>
      \${customer.specialRequests ? '<tr><td style="padding:6px 8px;color:#888">Notes</td><td style="padding:6px 8px;color:#333">' + customer.specialRequests + '</td></tr>' : ''}
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
    <p style="color:#fff;opacity:0.9;margin:4px 0 0">Ref: \${orderRef}</p>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #eee;border-top:none">
    <h3 style="color:#333;margin-top:0">Customer Info</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8;width:140px">Name</td><td style="padding:8px;border:1px solid #eee">\${customer.firstName} \${customer.lastName}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8">Email</td><td style="padding:8px;border:1px solid #eee"><a href="mailto:\${customer.email}">\${customer.email}</a></td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8">Phone</td><td style="padding:8px;border:1px solid #eee"><a href="tel:\${customer.phone}">\${customer.phone}</a></td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8">Delivery Date</td><td style="padding:8px;border:1px solid #eee">\${customer.deliveryDate || 'TBD'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8">Delivery Time</td><td style="padding:8px;border:1px solid #eee">\${customer.deliveryTime || 'TBD'}</td></tr>
      <tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8">Address</td><td style="padding:8px;border:1px solid #eee">\${customer.deliveryAddress}</td></tr>
      \${customer.specialRequests ? '<tr><td style="padding:8px;border:1px solid #eee;font-weight:bold;background:#F3E7D8">Special Requests</td><td style="padding:8px;border:1px solid #eee">' + customer.specialRequests + '</td></tr>' : ''}
    </table>

    <h3 style="color:#333">Order Summary</h3>
    \${orderDetailsHtml}

    <div style="background:#E36A2E;color:#fff;padding:16px;border-radius:8px;text-align:center;font-size:20px;font-weight:bold">
      Subtotal: ₱\${subtotal}
    </div>
  </div>
  <div style="padding:12px;text-align:center;color:#aaa;font-size:11px">
    Submitted at \${new Date().toISOString()} via mommamiacaters.com checkout
  </div>
</div>\`;

return [{
  json: {
    customerEmail: customer.email,
    customerName: customer.firstName + ' ' + customer.lastName,
    customerHtml,
    businessHtml,
    orderRef,
    subtotal
  }
}];
`;

// ============================================================
// Build the checkout workflow
// ============================================================
const workflow = {
  name: "Momma Mia Checkout",
  nodes: [
    // --- Webhook Trigger (typeVersion 1 + responseNode, matching chatbot pattern) ---
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

    // --- Format Order Data (Code node) ---
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

    // --- Send Customer Confirmation Email ---
    {
      parameters: {
        fromEmail: "mommamiacaters@gmail.com",
        toEmail: "={{ $('Format Order Data').first().json.customerEmail }}",
        subject: "=Order Confirmed — {{ $('Format Order Data').first().json.orderRef }} | Momma Mia Catering",
        emailFormat: "html",
        html: "={{ $('Format Order Data').first().json.customerHtml }}",
        options: {
          replyTo: "mommamiacaters@gmail.com"
        }
      },
      id: "checkout-email-customer-001",
      name: "Email Customer",
      type: "n8n-nodes-base.emailSend",
      typeVersion: 2,
      position: [400, -100],
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
          replyTo: "={{ $('Format Order Data').first().json.customerEmail }}"
        }
      },
      id: "checkout-email-business-001",
      name: "Email Business",
      type: "n8n-nodes-base.emailSend",
      typeVersion: 2,
      position: [400, 100],
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
      position: [700, 0]
    }
  ],

  connections: {
    "Checkout Webhook": {
      main: [[{ node: "Format Order Data", type: "main", index: 0 }]]
    },
    "Format Order Data": {
      main: [[{ node: "Email Customer", type: "main", index: 0 }]]
    },
    "Email Customer": {
      main: [[{ node: "Email Business", type: "main", index: 0 }]]
    },
    "Email Business": {
      main: [[{ node: "Webhook Response", type: "main", index: 0 }]]
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
  // Step 1: Check if checkout workflow already exists
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
    // Update existing workflow
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
    // Create new workflow
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

  // Step 2: Activate the workflow
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

  // Step 3: Test the webhook
  console.log('\nTesting webhook...');
  const testRes = await fetch(`${N8N_URL}/webhook/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customer: {
        firstName: "Test",
        lastName: "Order",
        email: "test@example.com",
        phone: "0000000000",
        deliveryDate: "2026-03-15",
        deliveryTime: "12:00",
        deliveryAddress: "Test Address",
        specialRequests: ""
      },
      order: {
        mealPlans: [{ type: "Double The Protein", quantity: 1 }],
        items: [{ name: "Test Item", type: "main", image: "" }],
        subtotal: 265
      },
      orderRef: "MM-TEST-0001"
    })
  });

  if (testRes.ok) {
    const testData = await testRes.json();
    console.log('Webhook test response:', JSON.stringify(testData, null, 2));
    console.log('\nCheckout workflow is LIVE at:');
    console.log(`  ${N8N_URL}/webhook/checkout`);
  } else {
    console.log('Test failed:', testRes.status, await testRes.text());
    console.log('The workflow may need a moment to initialize. Try again in a few seconds.');
  }
}

deploy().catch(console.error);
