import yaml
import glob
import os

# Create the orchestrator template
orchestrator = {
    "name": "🌋 Ermete Forge Orchestrator",
    "on": {
        "push": {
            "branches": ["main"]
        },
        "workflow_dispatch": None,
        "schedule": [
            {"cron": "0 4 * * *"}
        ]
    },
    "env": {
        "REGISTRY": "ghcr.io",
        "FEDORA_VERSION": 43
    },
    "jobs": {}
}

# Read all build-*.yml files
for file in sorted(glob.glob(".github/workflows/build-*.yml")):
    basename = os.path.basename(file).replace(".yml", "")
    with open(file, 'r') as f:
        data = yaml.safe_load(f)
        
    if "jobs" in data:
        for job_name, job_data in data["jobs"].items():
            # If the job is just named "build", rename it to the basename (e.g. build-upstream-cli)
            new_job_name = job_name
            if job_name == "build":
                new_job_name = basename
                job_data["name"] = f"📦 {basename.replace('build-', '').replace('-', ' ').title()}"
            
            # Remove global envs from the job if they are now global
            # Wait, safe_load/dump loses comments and formatting!
            orchestrator["jobs"][new_job_name] = job_data

with open(".github/workflows/ermete-forge-orchestrator.yml", "w") as f:
    yaml.dump(orchestrator, f, sort_keys=False, default_flow_style=False, allow_unicode=True)
