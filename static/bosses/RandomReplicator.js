if(cell.health < 10) 
    return 'R';
return Math.random() > 0.5 
  ? Math.random() > 0.5 
    ? 'ML'
    : 'DR' 
  : Math.random() > 0.5 
    ? 'MT'
    : 'MB';