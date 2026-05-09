import { createStatusBadge, getStatusClass } from "./StatusBadge.js";

export function createDataTable({ title, columns, rows, emptyMessage = "Sem dados cadastrados" }) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  const tableWrapper = document.createElement("div");
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const tbody = document.createElement("tbody");

  section.className = "dashboard-table";

  heading.className = "dashboard-table__title";
  heading.textContent = title;

  tableWrapper.className = "dashboard-table__wrapper";

  const headerRow = document.createElement("tr");
  columns.forEach((column) => {
    const th = document.createElement("th");
    th.scope = "col";
    th.textContent = column;
    headerRow.append(th);
  });

  thead.append(headerRow);

  if (!rows.length) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");

    td.colSpan = columns.length;
    td.textContent = emptyMessage;
    tr.append(td);
    tbody.append(tr);
  }

  rows.forEach((row) => {
    const tr = document.createElement("tr");

    row.forEach((cell) => {
      const td = document.createElement("td");
      const statusClass = getStatusClass(cell);

      if (statusClass) {
        td.append(createStatusBadge(cell, cell));
      } else {
        td.textContent = cell;
      }

      tr.append(td);
    });

    tbody.append(tr);
  });

  table.append(thead, tbody);
  tableWrapper.append(table);
  section.append(heading, tableWrapper);

  return section;
}
