describe('Automated Manual Data Entry', () => {
  it('Logs in, assigns classes to faculty, and adds students to classes 1-8', () => {
    cy.visit('http://localhost:5173/admin-login')

    // Login as Admin
    cy.get('input[placeholder="Enter your username/email"]').type('admin@gmail.com')
    cy.get('input[placeholder="Enter your password"]').type('Admin@123')
    cy.get('button.login-btn').click()

    cy.wait(3000)

    // Wait for Dashboard to load
    cy.url().should('include', '/admin-dashboard')

    // --- 1. Assign classes to faculty ---
    cy.visit('http://localhost:5173/admin/faculty')
    cy.wait(2000)

    // Find all faculty rows
    cy.get('table tbody tr').then($rows => {
      // Loop through first 20 faculty
      const count = Math.min($rows.length, 20)
      for (let i = 0; i < count; i++) {
        // We have to re-query elements to avoid detached DOM errors
        cy.get('table tbody tr').eq(i).find('button').contains('Edit').click()
        cy.wait(500)
        
        // Randomly assign a class grade from 1 to 8
        const randomClass = Math.floor(Math.random() * 8) + 1
        
        // Clear existing and type new class
        cy.get('input[placeholder="e.g. 10th or 10A,10B"]').clear().type(`${randomClass}`)
        
        // Save
        cy.get('button').contains('Save').click()
        cy.wait(1000) // wait for save
      }
    })

    // --- 2. Add 5 students to classes 1 through 8 ---
    cy.visit('http://localhost:5173/admin/students')
    cy.wait(2000)

    const firstNames = ['Aarav', 'Vihaan', 'Aditya', 'Arjun', 'Sai']
    const lastNames = ['Sharma', 'Patel', 'Singh', 'Kumar', 'Das']

    for (let c = 1; c <= 8; c++) {
      for (let s = 1; s <= 5; s++) {
        cy.get('button').contains('Add Student').click()
        cy.wait(500)

        const name = `${firstNames[s-1]} ${lastNames[s-1]}`
        const email = `student_c${c}_${s}@manual.com`
        const rollNo = `R${c}00${s}`

        cy.get('input[placeholder="Full Name"]').type(name)
        cy.get('input[placeholder="Email ID"]').type(email)
        cy.get('input[placeholder="Class (e.g. 10th)"]').type(`${c}`)
        cy.get('input[placeholder="Section (e.g. A)"]').type('A')
        cy.get('input[placeholder="Roll Number"]').type(rollNo)
        cy.get('select').eq(0).select('Male') // Gender
        
        // Save
        cy.get('form').find('button[type="submit"]').click()
        cy.wait(1000) // Wait for submission toast/refresh
      }
    }
  })
})
