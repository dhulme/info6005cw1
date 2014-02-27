var DATASET_SRC = 'dataset-edited.csv';

$(function() {
  loadDataset(function(err, rawData) {
    if (err) console.error(err);
    
    var processedData = processData(rawData);
    console.log(rawData)
    // Initialize global UI
    $(document).foundation();
    attachGlobalEvents(processedData);
  });
});

function processData(data) {
  var nest = d3.nest()
    .key(function(d) {
      return d.agencyName;
    })
    .key(function(d) {
      return d.investmentTitle;
    })
    .rollup(function(leaves) {
      var leaf;
      for (leaf in leaves) {
        leaves[leaf] = {
          projectName: leaves[leaf].projectName,
          projectedActualCostMillions: leaves[leaf].projectedActualCostMillions,
          plannedCostMillions: leaves[leaf].plannedCostMillions,
          costVarianceMillions: leaves[leaf].costVarianceMillions,
          startDate: leaves[leaf].startDate,
          // Saying endDate so that it matches with the gantt plugin
          endDate: leaves[leaf].completionDate
        };
      }
      return leaves;
    })
    .entries(data);
    
  var tree = {
    key: 'United States',
    values: nest
  };

  function scanNode(node) {
    if (node.hasOwnProperty('values')) {
      node.projectedActualCostMillions = 0;
      node.plannedCostMillions = 0;
      
      var child;
      for (child in node.values) {
        node.values[child].parent = node;
        scanNode(node.values[child]);
      }
    }
    
    if (node.parent) {
      node.parent.projectedActualCostMillions += node.projectedActualCostMillions;
      node.parent.plannedCostMillions += node.plannedCostMillions;
    }
  }
  
  scanNode(tree);
  
  // Compute cost variance for top layer
  tree.values.forEach(function(d) {
    d.costVariancePercentage = ((d.projectedActualCostMillions / d.plannedCostMillions) * 100) - 100;
    d.costVarianceMillions = d.projectedActualCostMillions - d.plannedCostMillions;
  });
  
  return tree;
}

// Function modified from http://bl.ocks.org/mbostock/406342 and
// http://bl.ocks.org/mbostock/4348373
function drawSunburst(root) {
  var width = $('#sunburstSvg').parents('.svg-container').width()
    , height = 600
    , radius = Math.min(width, height) / 2
    , color = d3.scale.category20c();
  
  var x = d3.scale.linear()
    .range([0, 2 * Math.PI]);

  var y = d3.scale.sqrt()
    .range([0, radius]);

  var svg = d3.select('#sunburstSvg')
      .attr('width', width)
      .attr('height', height)
    .append('g')
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')');
      
  var partition = d3.layout.partition()
      .sort(null)
      //.size([2 * Math.PI, radius * radius])
      .value(function(d) {
        // Default mode is to show actual cost
        return d.projectedActualCostMillions;
      })
      .children(function(d) {
        return d.values;
      });

  var arc = d3.svg.arc()
    .startAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x))); })
    .endAngle(function(d) { return Math.max(0, Math.min(2 * Math.PI, x(d.x + d.dx))); })
    .innerRadius(function(d) { return Math.max(0, y(d.y)); })
    .outerRadius(function(d) { return Math.max(0, y(d.y + d.dy)); });

  var path = svg.datum(root).selectAll('path')
      .data(partition.nodes)
    .enter().append('path')
      .attr('display', function(d) { 
        // Hide innermost ring
        //if (!d.depth || d.depth > 2) {
        //  return 'none';
        //}
      })
      .attr('d', arc)
      .style('stroke', '#fff')
      .style('fill', function(d) {
        // Make inner most ring white
        if (!d.depth) {
          return '#fff';
        } else {
          return color(d.children ? d.key : d.projectName);
        }
      })
      .style('fill-rule', 'evenodd')
      .attr('data-title', function(d) {
        return d.key || d.projectName;
      })
      .on('click', function(d) {
        path.transition()
          .duration(750)
          .attrTween('d', zoom(d));
      })
      .each(function(d) {
        // Stash old values for transition
        d.x0 = d.x;
        d.dx0 = d.dx;
        
        // Save data values to DOM object
        d3.select(this).attr('data-planned-cost-millions', d.plannedCostMillions);
        d3.select(this).attr('data-projected-actual-cost-millions', d.projectedActualCostMillions);
      });

  d3.selectAll('#sunburstControls input').on('change', function change() {
    var value;
    switch (this.id) {
      case 'actualSpendingRadio':
        value = function(d) {
          return d.projectedActualCostMillions;
        };
        break;
      case 'plannedSpendingRadio':
        value = function(d) {
          return d.plannedCostMillions;
        };
        break;
      default:
        value = null;
    }

    path
        .data(partition.value(value).nodes)
      .transition()
        .duration(1500)
        .attrTween('d', function(d) {
          var i = d3.interpolate({x: d.x0, dx: d.dx0}, d);
          return function(t) {
            var b = i(t);
            d.x0 = b.x;
            d.dx0 = b.dx;
            return arc(b);
          };
        });
  });

  // Interpolate the arcs in data space
  function zoom(d) {
    var xd = d3.interpolate(x.domain(), [d.x, d.x + d.dx]),
        yd = d3.interpolate(y.domain(), [d.y, 1]),
        yr = d3.interpolate(y.range(), [d.y ? 20 : 0, radius]);
    return function(d, i) {
      return i
          ? function(t) { return arc(d); }
          : function(t) { x.domain(xd(t)); y.domain(yd(t)).range(yr(t)); return arc(d); };
    };
  }

  d3.select(self.frameElement).style('height', height + 'px');
}

function attachSunburstEvents() {
  var tooltip = $('#tooltip');
  $('#sunburstSvg path')
    .mouseover(function(e) {
      var self = $(this);
      
      var costMillions = $('#actualSpendingRadio').prop('checked')
        ? self.data('projectedActualCostMillions')
        : self.data('plannedCostMillions');
        
      // Using http://stackoverflow.com/questions/11832914/round-up-to-2-decimal-places-in-javascript
      var cost2DP = Math.round((Number(costMillions) + 0.00001) * 100) / 100;
      
      var tooltipContent = self.data('title') + ' (' + cost2DP + ' $M)';
      
      tooltip
        .show()
        .css('left', e.clientX + 10)
        .css('top', e.clientY)
        .find('.content').html(tooltipContent);
    })
    .mouseleave(function(e) {
      tooltip.hide();
    });
    
  $('#resetSunburstButton').click(function() {
    $('path').first().d3Click();
  });
}

// Functioned modified from http://bost.ocks.org/mike/bar/2/
function drawBar(data, percentageMode) {
  // Remove all child elements that may exist
  $('#barSvg').empty();
  
  // Compute data attribute
  var dataAttr = percentageMode ? 'costVariancePercentage' : 'costVarianceMillions';
  
  function generateBarText(d) {
    // Using http://stackoverflow.com/questions/11832914/round-up-to-2-decimal-places-in-javascript
    var variance2DP = Math.round((Number(d[dataAttr]) + 0.00001) * 100) / 100;
    return d.key + ' (' + generateNumberString(variance2DP) + ')';
  }
  
  function generateNumberString(d) {
    var sign = d > 0 ? '+' : ''
      , unit = percentageMode ? '%' : ' $M';
      
    return sign + d + unit;
  }
  
  var svgContainerWidth = $('#barSvg').parents('.svg-container').width()
    , margin = {
      top: 20,
      right: 30,
      bottom: 50,
      left: 40
    }
    , width = svgContainerWidth - margin.left - margin.right
    , barHeight = 25
    , height = barHeight * data.length;

  pubData = data
  // Compute x range
  var x = d3.scale.linear()
    .domain([d3.min(data, function(d) {
      return d[dataAttr];
    }), d3.max(data, function(d) {
      return d[dataAttr];
    })])
    .range([0, width]);

  xscale = x

  var chart = d3.select('#barSvg')
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom)
    .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    
  var xAxis = d3.svg.axis()
    .scale(x)
    .orient('bottom')
    .tickFormat(generateNumberString);
    
  chart.append('g')
    .attr('class', 'x axis')
    .attr('transform', 'translate(0, ' + height + ')')
    .call(xAxis)
    .append('text')
      .attr('x', width / 2)
      .attr('y', margin.bottom - 10)
      .style('text-anchor', 'middle')
      .text(function() {
        return percentageMode
          ? 'Percentage of department budget spent'
          : 'Deparment budget spend';
      });

  var g = chart.selectAll('.bar').data(data).enter()
    .append('g')
       .attr('transform', function(d, i) {
          return 'translate(0,' + i * barHeight + ')';
        });
    
  g.append('rect')
    .attr('class', 'bar')
    .attr('width',0)
    .attr('x', function(d) {
      // If positive, shift to start at 0
      if (d[dataAttr] > 0) {
        return x(0);
      } else {
        return x(d[dataAttr]);
      }
    })
    .attr('height', barHeight - 1)
    .attr('data-tooltip-content', generateBarText)
    .transition()
      .duration(500)
      .attr('width', function(d) {
        if (d[dataAttr] > 0) {
          return x(d[dataAttr]);
        } else {
          return x(0) - x(d[dataAttr]);
        }
      });

  g.append('text')
    .attr('class', 'bar-overlay')
    .attr('x', function(d) {
      return x(d[dataAttr]) - 3;
    })
    .attr('y', barHeight / 2)
    .attr('dy', '.35em')
    .text(generateBarText)
    .each(function(d) {
      // Show label if it's smaller than the bar size
      var self = $(this);
      if (self.width() < x(d[dataAttr])) {
        self.show();
      }
    });
}

function drawGantt(tasks) {
  console.log(tasks)
  var taskStatus = {
      "SUCCEEDED" : "bar",
      "FAILED" : "bar-failed",
      "RUNNING" : "bar-running",
      "KILLED" : "bar-killed"
  };

  var taskNames = [ "D Job", "P Job", "E Job", "A Job", "N Job" ];

  tasks.sort(function(a, b) {
      return a.endDate - b.endDate;
  });
  var maxDate = tasks[tasks.length - 1].endDate;
  tasks.sort(function(a, b) {
      return a.startDate - b.startDate;
  });
  var minDate = tasks[0].startDate;

  var format = "%H:%M";

  var gantt = d3.gantt().taskTypes(taskNames).taskStatus(taskStatus).tickFormat(format);
  gantt(tasks);
}

function attachBarEvents(data) {
  var tooltip = $('#tooltip');
  $('#barSvg .bar, .bar-overlay')
    .mouseover(function(e) {
      tooltip
        .show()
        .css('left', e.clientX + 10)
        .css('top', e.clientY - 10)
        .find('.content').html($(this).data('tooltipContent'));
    })
    .mouseleave(function(e) {
      tooltip.hide();
    });
    
  $('#barControls input').change(function(e) {
    drawBar(data, (this.id === 'percentageVarianceRadio'));
    attachBarEvents(data);
  });
}

function attachGanttEvents(data) {
  var departmentSelect = $('#departmentSelect')
    , investmentSelect = $('#investmentSelect');
  
  // Set up department combo values
  var departmentSelectHTML = '';
  data.values.forEach(function(department, index) {
    departmentSelectHTML += '<option value="' + index + '">' + department.key + '</option>';
  });
  departmentSelect.html(departmentSelectHTML);
  
  var updateInvestmentList = function(values) {
    // And for investment combo (with default option)
    var investmentSelectHTML = '';
    values.forEach(function(investment, index) {
      investmentSelectHTML += '<option value="' + index + '">' + investment.key +'</option>';
    });
    investmentSelect.html(investmentSelectHTML);
  };
  
  // Set up listeners
  // On department change, update investments
  departmentSelect.change(function() {
    var selected = $(this).find(':selected')
      , index = Number(selected.val());
      
    updateInvestmentList(data.values[index].values);
  });
  
  // Set default investment values
  updateInvestmentList(data.values[0].values);
}

function loadDataset(done) {
  function type(data) {
    var obj = {
      uniqueInvestmentIdentifier: data['Unique Investment Identifier'],
      businessCaseId: Number(data['Business Case ID']),
      agencyCode: Number(data['Agency Code']),
      agencyName: data['Agency Name'],
      investmentTitle: data['Investment Title'],
      projectId: Number(data['Project ID']),
      agencyProjectId: data['Agency Project ID'],
      projectName: data['Project Name'],
      projectDescription: data['Project Description'],
      plannedProjectCompletionDate: new Date(data['Planned Project Completion Date (B2)']),
      projectedProjectCompletionDate: new Date(data['Projected/Actual Project Completion Date (B2)']),
      lifecycleCostMillions: Number(data['Lifecycle Cost ($ M)']),
      scheduleVarianceDays: Number(data['Schedule Variance (in days)']),
      scheduleVariancePercentage: Number(data['Schedule Variance (%)']),
      costVarianceMillions: Number(data['Cost Variance ($ M)']),
      costVarianceDays: Number(data['Cost Variance (%)']),
      plannedCostMillions: Number(data['Planned Cost ($ M)']),
      projectedActualCostMillions: Number(data['Projected/Actual Cost ($ M)']),
      uniqueProjectId: data['Unique Project ID']
    };
    
    // Set start and completion dates
    var startDateSplit = data['Start Date'].split('/')
      , completionDateSplit = data['Completion Date (B1)'].split('/');
      
    obj.startDate = new Date(startDateSplit[2], startDateSplit[1], startDateSplit[0]);
    obj.completionDate = new Date(completionDateSplit[2], completionDateSplit[1], completionDateSplit[0]);
    
    // Set updated date and time
    obj.updated = new Date(data['Updated Date']);
    var timeSplit = data['Updated Time'].split(':');
    obj.updated.setHours(timeSplit[0]);
    obj.updated.setMinutes(timeSplit[1]);
    obj.updated.setSeconds(timeSplit[2]);
   
    return obj;
  }
  
  d3.csv(DATASET_SRC, type, done);
}

function attachGlobalEvents(processedData) {
  $('#visList a').click(function() {
    var self = $(this);
    $('#visList').find('li').removeClass('active');
    self.parent().addClass('active');

    $('section.content').hide();
    
    var visualisationId = self.data('visualisationId');
    $('#' + visualisationId).show();
    switch (visualisationId) {
      case 'visualisation1':
        // Sunburst
        drawSunburst(processedData);
        attachSunburstEvents();
        break;
      case 'visualisation2':
        // Bar
        var barData = processedData.values;
        drawBar(barData, false);
        attachBarEvents(barData);
        break;
      case 'visualisation3':
        drawGantt(processedData.values[0].values[0].values)
        //attachGanttEvents(processedData);
        break;
    }
    
  });
  
  if (!window.location.hash) {
    window.location.hash = '#visualisation1';
  }
  
  var hashId = window.location.hash.split('#')[1];
  $('a[data-visualisation-id="' + hashId + '"]').click();
}


// From http://stackoverflow.com/questions/9063383/how-to-invoke-click-event-programmaticaly-in-d3
jQuery.fn.d3Click = function () {
  this.each(function (i, e) {
    var evt = document.createEvent("MouseEvents");
    evt.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);

    e.dispatchEvent(evt);
  });
};