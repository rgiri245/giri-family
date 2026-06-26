function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(data.sheet);

    if (!sheet) {
      sheet = ss.insertSheet(data.sheet);
      if (data.headers) sheet.appendRow(data.headers);
    }

    if (data.action === 'save') {
      const rows = sheet.getDataRange().getValues();
      // Check if header row exists, if not add it
      if (rows.length === 0 && data.headers) {
        sheet.appendRow(data.headers);
      }
      const idx = rows.findIndex((r, i) => i > 0 && String(r[0]) === String(data.id));
      if (idx >= 0) {
        sheet.getRange(idx + 1, 1, 1, data.row.length).setValues([data.row]);
      } else {
        sheet.appendRow(data.row);
      }
    } else if (data.action === 'delete') {
      const rows = sheet.getDataRange().getValues();
      const idx = rows.findIndex((r, i) => i > 0 && String(r[0]) === String(data.id));
      if (idx >= 0) sheet.deleteRow(idx + 1);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const name = e.parameter.sheet;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 1) {
      return ContentService
        .createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const rows = sheet.getDataRange().getValues();
    return ContentService
      .createTextOutput(JSON.stringify(rows))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
