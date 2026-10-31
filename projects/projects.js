import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import { fetchJSON, renderProjects } from '../global.js';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
renderProjects(projects, projectsContainer, 'h2');

const projectsTitle = document.querySelector('.projects-title');
if (projectsTitle && projects) {
  projectsTitle.textContent = `${projects.length} Projects`;
}

let selectedIndex = -1;
let selectedYear = null;
let query = '';

function applyFilters() {
  let filteredProjects = projects.filter((project) => {
    let matchesQuery = true;
    if (query) {
      let values = Object.values(project).join('\n').toLowerCase();
      matchesQuery = values.includes(query.toLowerCase());
    }
    let matchesYear = true;
    if (selectedYear) {
      matchesYear = project.year === selectedYear;
    }
    return matchesQuery && matchesYear;
  });

  renderProjects(filteredProjects, projectsContainer, 'h2');
}

function renderPieChart(projectsGiven) {
  // Re-calculate rolled data
  let newRolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );

  // Map rolled data into array of { value, label } objects
  let newData = newRolledData.map(([year, count]) => {
    return { value: count, label: year };
  });

  // If currently selected year is not present in new data, reset selection
  if (selectedYear && !newData.some((d) => d.label === selectedYear)) {
    selectedYear = null;
    selectedIndex = -1;
  } else if (selectedYear) {
    selectedIndex = newData.findIndex((d) => d.label === selectedYear);
  }

  // Clear existing paths and legend items
  let newSVG = d3.select('#projects-pie-plot');
  newSVG.selectAll('path').remove();

  let legend = d3.select('.legend');
  legend.selectAll('li').remove();

  let colors = d3.scaleOrdinal(d3.schemeTableau10);

  let sliceGenerator = d3.pie().value((d) => d.value);
  let arcData = sliceGenerator(newData);
  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  let arcs = arcData.map((d) => arcGenerator(d));

  arcs.forEach((arc, i) => {
    newSVG
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(i))
      .attr('class', () => (newData[i]?.label === selectedYear ? 'selected' : ''))
      .on('click', () => {
        selectedYear = selectedYear === newData[i].label ? null : newData[i].label;
        selectedIndex = selectedYear ? i : -1;

        newSVG
          .selectAll('path')
          .attr('class', (_, idx) => (newData[idx]?.label === selectedYear ? 'selected' : ''));

        legend
          .selectAll('li')
          .attr('class', (_, idx) => (newData[idx]?.label === selectedYear ? 'selected' : ''));

        applyFilters();
      });
  });

  newData.forEach((d, idx) => {
    legend
      .append('li')
      .attr('style', `--color:${colors(idx)}`)
      .attr('class', () => (d.label === selectedYear ? 'selected' : ''))
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on('click', () => {
        selectedYear = selectedYear === d.label ? null : d.label;
        selectedIndex = selectedYear ? idx : -1;

        newSVG
          .selectAll('path')
          .attr('class', (_, i) => (newData[i]?.label === selectedYear ? 'selected' : ''));

        legend
          .selectAll('li')
          .attr('class', (_, i) => (newData[i]?.label === selectedYear ? 'selected' : ''));

        applyFilters();
      });
  });
}

if (projects) {
  renderPieChart(projects);
}

let searchInput = document.querySelector('.searchBar');

if (searchInput) {
  searchInput.addEventListener('input', (event) => {
    query = event.target.value;

    let queryProjects = projects.filter((project) => {
      let values = Object.values(project).join('\n').toLowerCase();
      return values.includes(query.toLowerCase());
    });

    renderPieChart(queryProjects);
    applyFilters();
  });
}
