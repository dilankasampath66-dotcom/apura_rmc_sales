/**
 * Excel Export Engine
 * Uses SheetJS (XLSX CDN) to export Sales Visits, Pipeline Opportunities, Quotations,
 * Orders & Deliveries, and Activity Audit Logs to multi-tab or single-tab Excel files.
 */

class ExcelExporter {
  /**
   * Export all database tables into a single multi-sheet Excel Workbook (.xlsx)
   */
  exportFullSystemReport() {
    if (typeof XLSX === 'undefined') {
      window.showToast('Excel exporter library loading, please try again.', 'error');
      return;
    }

    const wb = XLSX.utils.book_new();

    // 1. Sales Visits Sheet
    const visits = window.db.getVisits().map(v => ({
      'Visit ID': v.id,
      'Date': v.date,
      'Customer Name': v.customer_name,
      'Sales Officer': v.sales_officer,
      'Location': v.location,
      'Contact': v.contact || '',
      'Customer Type': v.customer_type || '',
      'Est. Volume (m³)': v.project_size_m3,
      'Notes': v.notes || ''
    }));
    const wsVisits = XLSX.utils.json_to_sheet(visits);
    XLSX.utils.book_append_sheet(wb, wsVisits, 'Sales Visits');

    // 2. Opportunities Sheet
    const opps = window.db.getOpportunities().map(o => ({
      'Opp ID': o.id,
      'Visit ID': o.visit_id,
      'Customer Name': o.customer_name,
      'Sales Officer': o.sales_officer,
      'Stage': o.stage,
      'Expected Volume (m³)': o.expected_volume_m3,
      'Expected Value (LKR)': o.expected_value_lkr,
      'Probability (%)': o.probability,
      'Last Updated': o.updated_at ? o.updated_at.substring(0, 10) : '',
      'Lost Reason': o.lost_reason || ''
    }));
    const wsOpps = XLSX.utils.json_to_sheet(opps);
    XLSX.utils.book_append_sheet(wb, wsOpps, 'Pipeline Opportunities');

    // 3. Quotations Sheet
    const quotes = window.db.getQuotations().map(q => ({
      'Quote ID': q.id,
      'Opp ID': q.opportunity_id,
      'Concrete Grade': q.concrete_grade,
      'Distance (KM)': q.distance_km,
      'Pump Required': q.pump_required ? 'Yes' : 'No',
      'Price / m³ (LKR)': q.price_per_m3,
      'Total Value (LKR)': q.total_value,
      'Validity Date': q.validity_date
    }));
    const wsQuotes = XLSX.utils.json_to_sheet(quotes);
    XLSX.utils.book_append_sheet(wb, wsQuotes, 'Quotations');

    // 4. Orders & Delivery Sheet
    const orders = window.db.getOrders().map(o => ({
      'Order ID': o.id,
      'Opp ID': o.opportunity_id,
      'Customer Name': o.customer_name,
      'Sales Officer': o.sales_officer,
      'Confirmed Volume (m³)': o.confirmed_volume_m3,
      'Delivered Volume (m³)': o.delivered_volume_m3,
      'Remaining Volume (m³)': Math.max(0, o.confirmed_volume_m3 - o.delivered_volume_m3),
      'Unit Price / m³ (LKR)': o.unit_price_lkr,
      'Total Revenue (LKR)': o.delivered_volume_m3 * o.unit_price_lkr,
      'Status': o.status
    }));
    const wsOrders = XLSX.utils.json_to_sheet(orders);
    XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders & Deliveries');

    // 5. Daily Dispatch Logs Sheet
    const dispatchLogs = window.db.getDeliveryLogs().map(l => {
      const ord = window.db.getOrder(l.order_id);
      return {
        'Log ID': l.id,
        'Order ID': l.order_id,
        'Customer Name': ord ? ord.customer_name : '',
        'Dispatch Date': l.dispatch_date,
        'Volume Delivered (m³)': l.volume_m3,
        'Docket / Ticket #': l.docket_no || '',
        'Truck Mixer #': l.truck_no || '',
        'Logged By': l.logged_by || '',
        'Created Timestamp': l.created_at || ''
      };
    });
    const wsDispatch = XLSX.utils.json_to_sheet(dispatchLogs);
    XLSX.utils.book_append_sheet(wb, wsDispatch, 'Daily Dispatch Logs');

    // 6. Activity Log Sheet
    const logs = window.db.getLogs().map(l => ({
      'Log ID': l.id,
      'Timestamp': l.timestamp,
      'Action': l.action,
      'User': l.user,
      'Details': l.details
    }));
    const wsLogs = XLSX.utils.json_to_sheet(logs);
    XLSX.utils.book_append_sheet(wb, wsLogs, 'Audit Log');

    const fileName = `RMC_Sales_Full_Report_${new Date().toISOString().substring(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);

    window.db.logActivity('EXCEL_EXPORT', window.currentRole || 'User', `Exported full system Excel workbook: ${fileName}`);
    window.showToast(`Full Excel Report exported successfully! (${fileName})`, 'success');
  }

  /**
   * Export specific dataset to Excel
   */
  exportTableToExcel(type) {
    if (typeof XLSX === 'undefined') {
      window.showToast('Excel exporter library loading, please try again.', 'error');
      return;
    }

    let data = [];
    let sheetName = 'Export';
    let fileName = `RMC_${type}_${new Date().toISOString().substring(0, 10)}.xlsx`;

    switch (type) {
      case 'visits':
        sheetName = 'Sales Visits';
        data = window.db.getVisits().map(v => ({
          'ID': v.id, 'Date': v.date, 'Customer': v.customer_name,
          'Sales Officer': v.sales_officer, 'Location': v.location,
          'Contact': v.contact, 'Type': v.customer_type, 'Volume (m³)': v.project_size_m3, 'Notes': v.notes
        }));
        break;

      case 'pipeline':
        sheetName = 'CRM Opportunities';
        data = window.db.getOpportunities().map(o => ({
          'ID': o.id, 'Customer': o.customer_name, 'Sales Officer': o.sales_officer,
          'Stage': o.stage, 'Volume (m³)': o.expected_volume_m3, 'Value (LKR)': o.expected_value_lkr,
          'Probability (%)': o.probability, 'Updated': o.updated_at, 'Lost Reason': o.lost_reason
        }));
        break;

      case 'quotations':
        sheetName = 'Quotations';
        data = window.db.getQuotations().map(q => ({
          'ID': q.id, 'Opp ID': q.opportunity_id, 'Grade': q.concrete_grade,
          'Distance (KM)': q.distance_km, 'Pump': q.pump_required ? 'Yes' : 'No',
          'Price / m³ (LKR)': q.price_per_m3, 'Total Value (LKR)': q.total_value, 'Validity': q.validity_date
        }));
        break;

      case 'orders':
        sheetName = 'Supply Orders';
        data = window.db.getOrders().map(o => ({
          'Order ID': o.id, 'Customer': o.customer_name, 'Officer': o.sales_officer,
          'Confirmed (m³)': o.confirmed_volume_m3, 'Delivered (m³)': o.delivered_volume_m3,
          'Unit Price (LKR)': o.unit_price_lkr, 'Delivered Revenue (LKR)': o.delivered_volume_m3 * o.unit_price_lkr,
          'Status': o.status
        }));
        break;

      case 'activity':
        sheetName = 'Audit Log';
        data = window.db.getLogs().map(l => ({
          'ID': l.id, 'Timestamp': l.timestamp, 'Action': l.action, 'User': l.user, 'Details': l.details
        }));
        break;
    }

    if (data.length === 0) {
      window.showToast('No data available to export.', 'warning');
      return;
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, fileName);

    window.db.logActivity('EXCEL_EXPORT', window.currentRole || 'User', `Exported ${sheetName} Excel file: ${fileName}`);
    window.showToast(`${sheetName} exported to Excel! (${fileName})`, 'success');
  }
}

window.excelExporter = new ExcelExporter();
