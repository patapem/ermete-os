echo "name: 🌋 Ermete Forge Orchestrator" > .github/workflows/ermete-forge-orchestrator.yml
echo "" >> .github/workflows/ermete-forge-orchestrator.yml
echo "on:" >> .github/workflows/ermete-forge-orchestrator.yml
echo "  push:" >> .github/workflows/ermete-forge-orchestrator.yml
echo "    branches: [ main ]" >> .github/workflows/ermete-forge-orchestrator.yml
echo "  workflow_dispatch:" >> .github/workflows/ermete-forge-orchestrator.yml
echo "  schedule:" >> .github/workflows/ermete-forge-orchestrator.yml
echo "    - cron: '0 4 * * *'" >> .github/workflows/ermete-forge-orchestrator.yml
echo "" >> .github/workflows/ermete-forge-orchestrator.yml
echo "env:" >> .github/workflows/ermete-forge-orchestrator.yml
echo "  REGISTRY: ghcr.io" >> .github/workflows/ermete-forge-orchestrator.yml
echo "  FEDORA_VERSION: 43" >> .github/workflows/ermete-forge-orchestrator.yml
echo "" >> .github/workflows/ermete-forge-orchestrator.yml
echo "jobs:" >> .github/workflows/ermete-forge-orchestrator.yml

for file in .github/workflows/build-*.yml; do
  basename=$(basename $file .yml)
  jobname=${basename#build-}
  jobtitle=$(echo "$jobname" | tr '-' ' ' | awk '{for(i=1;i<=NF;i++){ $i=toupper(substr($i,1,1)) substr($i,2) }}1')
  
  # Remove everything before and including jobs:
  awk '/^jobs:/ {flag=1; next} flag {print}' "$file" > temp_job.yml
  
  # Replace the FIRST occurrence of "  build:" with our named job
  sed -i "0,/^  build:/s/^  build:/  ${jobname}:\n    name: 📦 ${jobtitle}/" temp_job.yml
  
  cat temp_job.yml >> .github/workflows/ermete-forge-orchestrator.yml
  echo "" >> .github/workflows/ermete-forge-orchestrator.yml
done

rm temp_job.yml
