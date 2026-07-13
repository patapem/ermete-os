use std::process::Command;

fn main() {
    println!("Starting Diagnostic: Network Stack...");
    let ping = Command::new("ping").args(["-c", "1", "1.1.1.1"]).output();
    
    match ping {
        Ok(out) if out.status.success() => println!("Network: OK"),
        Ok(_) => {
            println!("Network: FAILED. Attempting Self-Heal...");
            
            match Command::new("nmcli").args(["networking", "off"]).output() {
                Ok(out) if !out.status.success() => {
                    eprintln!("Error: nmcli networking off failed with status: {}", out.status);
                }
                Err(e) => eprintln!("Failed to execute nmcli networking off: {}", e),
                Ok(_) => {}
            }
            
            std::thread::sleep(std::time::Duration::from_secs(1));
            
            match Command::new("nmcli").args(["networking", "on"]).output() {
                Ok(out) if out.status.success() => println!("Network: Restarted TCP/IP stack."),
                Ok(out) => eprintln!("Error: nmcli networking on failed with status: {}", out.status),
                Err(e) => eprintln!("Failed to execute nmcli networking on: {}", e),
            }
        }
        Err(e) => eprintln!("Failed to execute ping: {}", e),
    }
}
