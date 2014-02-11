var DATASET_SRC = 'dataset-edited.csv';

$(function() {
  drawGraph();
});

function drawGraph() {
  var width = 1000
    , barHeight = 20;
    
  var x = d3.scale.linear()
    .range([0, width]);
    
  var chart = d3.select('.chart')
    .attr('width', width);
    
  loadDataset(function(err, data) {
    if (err) console.error(err);

    x.domain([0, d3.max(data, function(d) {
      return d.projectedActualCostMillions;
    })]);
  
    console.log(d3.max(data, function(d) {
      return d.projectedActualCostMillions;
    }))

    var bar = chart.selectAll('g')
        .data(data)
      .enter().append('g')
        .attr('transform', function(d, i) {
          return 'translate(0,' + i * barHeight + ')';
        });

    bar.append('rect')
      .attr('width', function(d) {
        return x(d.projectedActualCostMillions);
      })
      .attr('height', barHeight - 1);

    bar.append('text')
      .attr('x', function(d) {
        return x(d.projectedActualCostMillions) - 3;
      })
      .attr('y', barHeight / 2)
      .attr('dy', '.35em')
      .text(function(d) {
        return d.projectedActualCostMillions;
      });
  });
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

function isUniqueInvestmentIdentifier(x) {
  // Split by hypen
  var xSplit = x.split('-');
  
  // Length should be 2
  if (xSplit.length !== 2) return false;
  
  // Both parts should be numbers
  if (isNaN(xSplit[0]) || isNaN(xSplit[1])) return false;
  
  return true;
}