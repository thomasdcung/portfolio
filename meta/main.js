import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

let data = [];
let commits = [];
let filteredCommits = [];
let xScale, yScale;
let commitProgress = 100;
let timeScale;
let commitMaxTime;
let colors = d3.scaleOrdinal(d3.schemeTableau10);

async function loadData() {
  data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  processCommits();

  timeScale = d3
    .scaleTime()
    .domain([
      d3.min(commits, (d) => d.datetime),
      d3.max(commits, (d) => d.datetime),
    ])
    .range([0, 100]);

  commitMaxTime = timeScale.invert(commitProgress);
  filteredCommits = commits;

  renderCommitInfo(data, commits);
  renderScatterPlot(data, filteredCommits);
  renderScatterStory();
  updateFileDisplay(filteredCommits);
  setupSlider();
  setupScrolly();
}

function processCommits() {
  commits = d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];
      let { author, date, time, timezone, datetime } = first;
      let ret = {
        id: commit,
        url: 'https://github.com/thomasdcung/portfolio/commit/' + commit,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: true,
        writable: true,
        enumerable: false,
      });

      return ret;
    })
    .sort((a, b) => a.datetime - b.datetime);
}

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  // Total LOC
  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);

  // Total commits
  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);

  // Number of files
  const numFiles = d3.group(data, (d) => d.file).size;
  dl.append('dt').text('Number of files');
  dl.append('dd').text(numFiles);

  // File lengths
  const fileLengths = d3.rollups(
    data,
    (v) => v.length,
    (d) => d.file,
  );
  const maxFileLength = d3.max(fileLengths, (d) => d[1]);
  dl.append('dt').text('Maximum file length');
  dl.append('dd').text(`${maxFileLength} lines`);

  const avgFileLength = d3.mean(fileLengths, (d) => d[1]);
  dl.append('dt').text('Average file length');
  dl.append('dd').text(`${avgFileLength.toFixed(1)} lines`);

  // Max depth
  const maxDepth = d3.max(data, (d) => d.depth);
  dl.append('dt').text('Maximum depth');
  dl.append('dd').text(maxDepth);

  // Longest line length
  const longestLine = d3.max(data, (d) => d.length);
  dl.append('dt').text('Longest line');
  dl.append('dd').text(`${longestLine} characters`);
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');
  const date = document.getElementById('commit-date');
  const time =
    document.getElementById('commit-tooltip-time') ||
    document.querySelector('#commit-tooltip #commit-time');
  const author = document.getElementById('commit-author');
  const lines = document.getElementById('commit-lines');

  if (!commit || Object.keys(commit).length === 0) {
    if (link) {
      link.href = '';
      link.textContent = '';
    }
    if (date) date.textContent = '';
    if (time) time.textContent = '';
    if (author) author.textContent = '';
    if (lines) lines.textContent = '';
    return;
  }

  if (link) {
    link.href = commit.url;
    link.textContent = commit.id;
  }
  if (date) {
    date.textContent = commit.datetime?.toLocaleString('en', {
      dateStyle: 'full',
    });
  }
  if (time) {
    time.textContent = commit.datetime?.toLocaleTimeString('en', {
      timeStyle: 'short',
    });
  }
  if (author) {
    author.textContent = commit.author;
  }
  if (lines) {
    lines.textContent = commit.totalLines;
  }
}

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');
  if (!tooltip) return;
  tooltip.hidden = !isVisible;
  tooltip.style.opacity = isVisible ? '1' : '0';
  tooltip.style.visibility = isVisible ? 'visible' : 'hidden';
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  if (!tooltip) return;
  tooltip.style.left = `${event.clientX + 10}px`;
  tooltip.style.top = `${event.clientY + 10}px`;
}

window.addEventListener('scroll', () => {
  updateTooltipVisibility(false);
});

function renderScatterPlot(data, commitsToRender) {
  const width = 1000;
  const height = 600;

  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  yScale = d3.scaleLinear().domain([0, 24]).range([usableArea.bottom, usableArea.top]);

  // Gridlines
  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);

  gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  // Axes with marked classes for updating
  const xAxis = d3.axisBottom(xScale);
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

  svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .attr('class', 'x-axis')
    .call(xAxis);

  svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis')
    .call(yAxis);

  // Group for dots
  svg.append('g').attr('class', 'dots');

  // Brush
  const brush = d3
    .brush()
    .extent([
      [usableArea.left, usableArea.top],
      [usableArea.right, usableArea.bottom],
    ])
    .on('start brush end', brushed);

  svg.call(brush);

  // Render initial dots
  updateScatterPlot(data, commitsToRender);
}

function updateScatterPlot(data, commitsToRender) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select('#chart').select('svg');
  if (svg.empty()) return;

  if (commitsToRender.length > 0) {
    const dateExtent = d3.extent(commitsToRender, (d) => d.datetime);
    if (dateExtent[0] && dateExtent[1] && dateExtent[0].getTime() !== dateExtent[1].getTime()) {
      xScale = xScale.domain(dateExtent);
    } else {
      xScale = xScale.domain(d3.extent(commits, (d) => d.datetime));
    }
  } else {
    xScale = xScale.domain(d3.extent(commits, (d) => d.datetime));
  }

  const [minLines, maxLines] = d3.extent(commitsToRender, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines || 0, maxLines || 1]).range([2, 30]);

  const xAxis = d3.axisBottom(xScale);
  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  const dots = svg.select('g.dots');
  const sortedCommits = d3.sort(commitsToRender, (d) => -d.totalLines);

  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .style('--r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mousemove', (event) => {
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  // Raise dots and elements after overlay so hover and tooltips work with brush
  svg.selectAll('.dots, .overlay ~ *').raise();
}

function updateFileDisplay(commitsToDisplay) {
  let lines = commitsToDisplay.flatMap((d) => d.lines);
  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    })
    .sort((a, b) => b.lines.length - a.lines.length);

  let filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (d) => d.name)
    .join(
      (enter) =>
        enter.append('div').call((div) => {
          div.append('dt').append('code');
          div.append('dd');
        }),
      (update) => update,
      (exit) => exit.remove(),
    );

  filesContainer
    .select('dt > code')
    .html((d) => `${d.name} <small>${d.lines.length} lines</small>`);

  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`);
}

function renderScatterStory() {
  d3.select('#scatter-story')
    .selectAll('.step')
    .data(commits)
    .join('div')
    .attr('class', 'step')
    .html(
      (d, i) => `
      <p>On ${d.datetime.toLocaleString('en', {
        dateStyle: 'full',
        timeStyle: 'short',
      })}, I made <a href="${d.url}" target="_blank">${
        i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
      }</a>.</p>
      <p>I edited ${d.totalLines} lines across ${
        d3.rollups(
          d.lines,
          (D) => D.length,
          (d) => d.file,
        ).length
      } files.</p>
      <p>Then I looked over all I had made, and I saw that it was very good.</p>
    `,
    );
}

function setupSlider() {
  const slider = document.getElementById('commit-progress');
  const commitTime = document.querySelector('time#commit-time');

  function onTimeSliderChange() {
    commitProgress = Number(slider.value);
    commitMaxTime = timeScale.invert(commitProgress);
    if (commitTime) {
      commitTime.textContent = commitMaxTime.toLocaleString('en', {
        dateStyle: 'long',
        timeStyle: 'short',
      });
    }
    filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);
    updateScatterPlot(data, filteredCommits);
    updateFileDisplay(filteredCommits);
  }

  if (slider) {
    slider.addEventListener('input', onTimeSliderChange);
    onTimeSliderChange();
  }
}

function setupScrolly() {
  const scroller = scrollama();
  scroller
    .setup({
      container: '#scrolly-1',
      step: '#scrolly-1 .step',
      offset: 0.5,
    })
    .onStepEnter((response) => {
      const commit = response.element.__data__;
      if (!commit) return;
      const commitDate = commit.datetime;
      filteredCommits = commits.filter((d) => d.datetime <= commitDate);
      updateScatterPlot(data, filteredCommits);
      updateFileDisplay(filteredCommits);

      const slider = document.getElementById('commit-progress');
      if (slider) {
        slider.value = timeScale(commitDate);
        const commitTime = document.querySelector('time#commit-time');
        if (commitTime) {
          commitTime.textContent = commitDate.toLocaleString('en', {
            dateStyle: 'long',
            timeStyle: 'short',
          });
        }
      }
    });
}

function brushed(event) {
  const selection = event.selection;

  d3.selectAll('circle').classed('selected', (d) => isCommitSelected(selection, d));

  renderSelectionCount(selection);
  renderLanguageBreakdown(selection);
}

function isCommitSelected(selection, commit) {
  if (!selection || !commit) return false;
  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x >= x0 && x <= x1 && y >= y0 && y <= y1;
}

function renderSelectionCount(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const countElement = document.querySelector('#selection-count');
  if (countElement) {
    countElement.textContent = `${selectedCommits.length || 'No'} commits selected`;
  }

  return selectedCommits;
}

function renderLanguageBreakdown(selection) {
  const selectedCommits = selection
    ? filteredCommits.filter((d) => isCommitSelected(selection, d))
    : [];

  const container = document.querySelector('#language-breakdown');
  if (!container) return;
  container.innerHTML = '';

  if (selectedCommits.length === 0) {
    return;
  }

  const lines = selectedCommits.flatMap((d) => d.lines);

  const breakdown = d3.rollup(
    lines,
    (v) => v.length,
    (d) => d.type,
  );

  for (const [language, count] of breakdown) {
    const proportion = count / lines.length;
    const formatted = d3.format('.1~%')(proportion);
    container.innerHTML += `
      <dt>${language}</dt>
      <dd>${count} lines (${formatted})</dd>
    `;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
});
