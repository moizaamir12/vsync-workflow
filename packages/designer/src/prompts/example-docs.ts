/**
 * Example workflow JSON documents served by the get_example tool.
 * Keyed by example slug.
 */

const API_INTEGRATION = `{
  "name": "Weather Dashboard",
  "triggerType": "interactive",
  "triggerConfig": {},
  "blocks": [
    {
      "id": "fetch_weather",
      "name": "Fetch Weather Data",
      "type": "fetch",
      "logic": {
        "fetch_url": "https://api.openweathermap.org/data/2.5/weather?q=$event.city&appid=$keys.OPENWEATHER_KEY&units=metric",
        "fetch_method": "GET",
        "fetch_headers": {},
        "fetch_timeout_ms": 10000,
        "fetch_bind_value": "weather"
      },
      "order": 0
    },
    {
      "id": "extract_data",
      "name": "Extract Key Fields",
      "type": "object",
      "logic": {
        "object_operation": "create",
        "object_value": {
          "city": "$state.weather.name",
          "temp": "$state.weather.main.temp",
          "humidity": "$state.weather.main.humidity",
          "description": "$state.weather.weather[0].description",
          "wind_speed": "$state.weather.wind.speed"
        },
        "object_bind_value": "summary"
      },
      "order": 1
    },
    {
      "id": "show_weather",
      "name": "Display Weather",
      "type": "ui_details",
      "logic": {
        "ui_details_data": "$state.summary",
        "ui_details_title": "Weather Report",
        "ui_details_layout": "card",
        "ui_details_fields": [
          { "key": "city", "label": "City" },
          { "key": "temp", "label": "Temperature", "format": "number", "suffix": " C" },
          { "key": "humidity", "label": "Humidity", "format": "number", "suffix": "%" },
          { "key": "description", "label": "Conditions" },
          { "key": "wind_speed", "label": "Wind Speed", "format": "number", "suffix": " m/s" }
        ]
      },
      "order": 2
    }
  ]
}`;

const BARCODE_SCANNER = `{
  "name": "Inventory Scanner",
  "triggerType": "interactive",
  "triggerConfig": {},
  "blocks": [
    {
      "id": "scan_barcode",
      "name": "Scan Product Barcode",
      "type": "ui_camera",
      "logic": {
        "ui_camera_title": "Scan Product",
        "ui_camera_instructions": "Point the camera at the product barcode",
        "ui_camera_mode": "barcode",
        "ui_camera_bind_value": "scanResult"
      },
      "order": 0
    },
    {
      "id": "lookup_product",
      "name": "Look Up Product",
      "type": "fetch",
      "logic": {
        "fetch_url": "https://api.example.com/inventory/$state.scanResult.data",
        "fetch_method": "GET",
        "fetch_headers": {
          "Authorization": "Bearer $keys.INVENTORY_API_KEY"
        },
        "fetch_bind_value": "product"
      },
      "order": 1
    },
    {
      "id": "update_form",
      "name": "Update Quantity",
      "type": "ui_form",
      "logic": {
        "ui_form_title": "Update Stock: $state.product.name",
        "ui_form_fields": [
          {
            "key": "quantity",
            "label": "New Quantity",
            "type": "number",
            "required": true,
            "placeholder": "Enter current stock count"
          },
          {
            "key": "location",
            "label": "Shelf Location",
            "type": "text",
            "required": false,
            "placeholder": "e.g. A-12"
          },
          {
            "key": "condition",
            "label": "Condition",
            "type": "select",
            "required": true,
            "options": ["Good", "Damaged", "Expired"]
          }
        ],
        "ui_form_submit_label": "Update Inventory",
        "ui_form_bind_value": "formData"
      },
      "order": 2
    },
    {
      "id": "save_update",
      "name": "Save to Server",
      "type": "fetch",
      "logic": {
        "fetch_url": "https://api.example.com/inventory/$state.scanResult.data",
        "fetch_method": "PATCH",
        "fetch_body": "$state.formData",
        "fetch_headers": {
          "Authorization": "Bearer $keys.INVENTORY_API_KEY",
          "Content-Type": "application/json"
        },
        "fetch_bind_value": "saveResult"
      },
      "order": 3
    },
    {
      "id": "show_confirmation",
      "name": "Confirmation",
      "type": "ui_details",
      "logic": {
        "ui_details_data": {
          "product": "$state.product.name",
          "quantity": "$state.formData.quantity",
          "status": "Updated successfully"
        },
        "ui_details_title": "Inventory Updated",
        "ui_details_layout": "card"
      },
      "order": 4
    }
  ]
}`;

const DATA_PROCESSING = `{
  "name": "CSV Report Generator",
  "triggerType": "schedule",
  "triggerConfig": {
    "schedule_cron": "0 8 * * MON"
  },
  "blocks": [
    {
      "id": "fetch_data",
      "name": "Fetch Weekly Sales",
      "type": "fetch",
      "logic": {
        "fetch_url": "https://api.example.com/sales?period=weekly",
        "fetch_method": "GET",
        "fetch_headers": {
          "Authorization": "Bearer $keys.SALES_API_KEY"
        },
        "fetch_bind_value": "salesData"
      },
      "order": 0
    },
    {
      "id": "filter_active",
      "name": "Filter Active Sales",
      "type": "array",
      "logic": {
        "array_operation": "filter",
        "array_input": "$state.salesData.transactions",
        "array_filter_mode": "equals",
        "array_filter_field": "status",
        "array_filter_value": "completed",
        "array_bind_value": "activeSales"
      },
      "order": 1
    },
    {
      "id": "sort_by_amount",
      "name": "Sort by Amount",
      "type": "array",
      "logic": {
        "array_operation": "sort",
        "array_input": "$state.activeSales",
        "array_sort_field": "amount",
        "array_sort_direction": "desc",
        "array_bind_value": "sorted"
      },
      "order": 2
    },
    {
      "id": "calculate_total",
      "name": "Calculate Total Revenue",
      "type": "math",
      "logic": {
        "math_operation": "sum",
        "math_input": "$state.sorted",
        "math_bind_value": "totalRevenue"
      },
      "order": 3
    },
    {
      "id": "format_report",
      "name": "Build Report Object",
      "type": "object",
      "logic": {
        "object_operation": "create",
        "object_value": {
          "title": "Weekly Sales Report",
          "generatedAt": "$run.startedAt",
          "totalRevenue": "$state.totalRevenue",
          "transactionCount": "$state.sorted.length",
          "topSales": "$state.sorted"
        },
        "object_bind_value": "report"
      },
      "order": 4
    },
    {
      "id": "send_report",
      "name": "Send Report to Slack",
      "type": "fetch",
      "logic": {
        "fetch_url": "$keys.SLACK_WEBHOOK_URL",
        "fetch_method": "POST",
        "fetch_body": {
          "text": "Weekly Sales Report: $state.totalRevenue total from $state.sorted.length transactions"
        },
        "fetch_bind_value": "slackResult"
      },
      "order": 5
    }
  ]
}`;

const FORM_WORKFLOW = `{
  "name": "Employee Onboarding",
  "triggerType": "interactive",
  "triggerConfig": {},
  "blocks": [
    {
      "id": "employee_form",
      "name": "Employee Information",
      "type": "ui_form",
      "logic": {
        "ui_form_title": "New Employee Details",
        "ui_form_fields": [
          { "key": "firstName", "label": "First Name", "type": "text", "required": true },
          { "key": "lastName", "label": "Last Name", "type": "text", "required": true },
          { "key": "email", "label": "Work Email", "type": "email", "required": true },
          { "key": "department", "label": "Department", "type": "select", "required": true, "options": ["Engineering", "Design", "Marketing", "Sales", "HR"] },
          { "key": "startDate", "label": "Start Date", "type": "date", "required": true },
          { "key": "remote", "label": "Remote Worker", "type": "toggle", "required": false }
        ],
        "ui_form_submit_label": "Submit",
        "ui_form_bind_value": "employee"
      },
      "order": 0
    },
    {
      "id": "create_account",
      "name": "Create User Account",
      "type": "fetch",
      "logic": {
        "fetch_url": "https://api.example.com/users",
        "fetch_method": "POST",
        "fetch_body": "$state.employee",
        "fetch_headers": {
          "Authorization": "Bearer $keys.ADMIN_API_KEY",
          "Content-Type": "application/json"
        },
        "fetch_bind_value": "accountResult"
      },
      "order": 1
    },
    {
      "id": "generate_welcome",
      "name": "Generate Welcome Email",
      "type": "agent",
      "logic": {
        "agent_model": "gpt-4o-mini",
        "agent_prompt": "Write a brief, friendly welcome email for a new employee named $state.employee.firstName $state.employee.lastName joining the $state.employee.department department on $state.employee.startDate. Include their login email: $state.employee.email.",
        "agent_type": "text",
        "agent_bind_value": "welcomeEmail"
      },
      "order": 2
    },
    {
      "id": "show_summary",
      "name": "Onboarding Summary",
      "type": "ui_details",
      "logic": {
        "ui_details_data": {
          "name": "$state.employee.firstName $state.employee.lastName",
          "email": "$state.employee.email",
          "department": "$state.employee.department",
          "accountCreated": true,
          "welcomeEmailDraft": "$state.welcomeEmail"
        },
        "ui_details_title": "Onboarding Complete",
        "ui_details_layout": "list"
      },
      "order": 3
    }
  ]
}`;

export const EXAMPLE_DOCS: Record<string, string> = {
  "api-integration": API_INTEGRATION,
  "barcode-scanner": BARCODE_SCANNER,
  "data-processing": DATA_PROCESSING,
  "form-workflow": FORM_WORKFLOW,
};
