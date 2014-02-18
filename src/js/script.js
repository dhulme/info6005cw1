var DATASET_SRC = 'dataset-edited.csv';

$(function() {
  loadDataset(function(err, data) {
    if (err) console.error(err);
    
    // Initialize foundation
    $(document).foundation();
    
    // Sunburst
    var sunburstData = processDataForSunburst(data);
    drawSunburst(sunburstData);
    attachSunburstEvents();
  });
});

function processDataForSunburst(data) {
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
          plannedCostMillions: leaves[leaf].plannedCostMillions
        };
      }
      return leaves;
    })
    .entries(data);
    
  return {
    key: 'US Deparatment Spending',
    values: nest
  };
}

// Function modified from http://bl.ocks.org/mbostock/406342 and
// http://bl.ocks.org/mbostock/4348373
function drawSunburst(root) {
  var width = $('#svgContainer').width()
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
          return color((d.children ? d : d.parent).key);
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
      .each(stash)
      .each(function(d) {
        // Else will have to examine leaf nodes
        var plannedCostMillionsTotal = 0
          , projectedActualCostMillionsTotal = 0;
        
        // This is expensive. Should look at merging into existing functions.
        function scanNode(node) {
          if (node.hasOwnProperty('children')) {
            var child;
            for (child in node.children) {
              scanNode(node.children[child]);
            }
          } else {
            projectedActualCostMillionsTotal += node.projectedActualCostMillions;
            plannedCostMillionsTotal += node.plannedCostMillions;
          }
        }
        
        scanNode(d);
        
        d3.select(this).attr('data-planned-cost-millions', plannedCostMillionsTotal);
        d3.select(this).attr('data-projected-actual-cost-millions', projectedActualCostMillionsTotal);
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

  // Stash the old values for transition.
  function stash(d) {
    d.x0 = d.x;
    d.dx0 = d.dx;
  }

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
    $('path').first().d3Click()
  })
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
      startDate: new Date(['Start Date']),
      completionDate: new Date(['Completion Date (B1)']),
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
    
    // Set updated date and time
    obj.updated = new Date(data['Updated Date']);
    var timeSplit = data['Updated Time'].split(':');
    obj.updated.setHours(timeSplit[0]);
    obj.updated.setMinutes(timeSplit[1]);
    obj.updated.setSeconds(timeSplit[2]);
   
    return obj;
  }
  
  d3.xhr(DATASET_SRC).get(function(err, res) {
    var rawText = res.responseText;
    
    var rawLines = rawText.split('\n')
      , cleanedLines = [];
   
    var i = 0
      , line = '';
      
    for (i in rawLines) {
      line = rawLines[i];
      
      // If line is comment, ignore
      if (line[0] !== '#') {
        cleanedLines.push(line);
      }
    }
    
    var cleanedCsv = d3.csv.parse(cleanedLines.join('\n'), type);
    
    done(err, cleanedCsv);
  });
}

// From http://stackoverflow.com/questions/9063383/how-to-invoke-click-event-programmaticaly-in-d3
jQuery.fn.d3Click = function () {
  this.each(function (i, e) {
    var evt = document.createEvent("MouseEvents");
    evt.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);

    e.dispatchEvent(evt);
  });
};