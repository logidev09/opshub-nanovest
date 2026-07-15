export function exportToCSV(data: any[], headers: { key: string; label: string }[], fileName: string) {
  const csvRows = [];

  // Add headers
  csvRows.push(headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(","));

  // Add data rows
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header.key];
      const escaped = ("" + (val ?? "")).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvString = "\ufeff" + csvRows.join("\r\n"); // UTF-8 BOM to display Indonesian accents/characters correctly in Excel
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
